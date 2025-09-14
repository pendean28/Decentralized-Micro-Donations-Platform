(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-CAUSE-ID u101)
(define-constant ERR-INVALID-AMOUNT u102)
(define-constant ERR-INVALID-TOKEN u103)
(define-constant ERR-CAUSE-NOT-ACTIVE u104)
(define-constant ERR-DONATION-FAILED u105)
(define-constant ERR-REFUND-NOT-ALLOWED u106)
(define-constant ERR-INSUFFICIENT-BALANCE u107)
(define-constant ERR-INVALID-RECIPIENT u108)
(define-constant ERR-MAX-DONATIONS-EXCEEDED u109)
(define-constant ERR-INVALID-FEE-RATE u110)
(define-constant ERR-INVALID-MIN-DONATION u111)
(define-constant ERR-INVALID-MAX-DONATION u112)
(define-constant ERR-INVALID-STATUS u113)
(define-constant ERR-INVALID-TIMESTAMP u114)
(define-constant ERR-INVALID-CURRENCY u115)
(define-constant ERR-INVALID-MILESTONE u116)
(define-constant ERR-ESCROW-FAIL u117)
(define-constant ERR-EVENT-EMIT-FAIL u118)
(define-constant ERR-AUTHORITY-NOT-SET u119)
(define-constant ERR-INVALID-UPDATE u120)

(define-data-var next-donation-id uint u0)
(define-data-var max-donations uint u10000)
(define-data-var platform-fee-rate uint u5)
(define-data-var min-donation uint u1)
(define-data-var max-donation uint u1000000)
(define-data-var authority-contract (optional principal) none)
(define-data-var escrow-contract (optional principal) none)
(define-data-var cause-factory-contract (optional principal) none)

(define-map donations
  uint
  {
    cause-id: uint,
    donor: principal,
    amount: uint,
    token: (string-utf8 20),
    timestamp: uint,
    status: bool,
    refunded: bool,
    milestone-id: (optional uint)
  }
)

(define-map cause-totals
  uint
  { total-amount: uint, donor-count: uint }
)

(define-map refunds
  uint
  { donation-id: uint, reason: (string-utf8 100), timestamp: uint }
)

(define-read-only (get-donation (id uint))
  (map-get? donations id)
)

(define-read-only (get-cause-total (cause-id uint))
  (map-get? cause-totals cause-id)
)

(define-read-only (get-refund (id uint))
  (map-get? refunds id)
)

(define-private (validate-amount (amount uint))
  (if (and (>= amount (var-get min-donation)) (<= amount (var-get max-donation)))
      (ok true)
      (err ERR-INVALID-AMOUNT))
)

(define-private (validate-cause-id (cause-id uint))
  (if (> cause-id u0)
      (ok true)
      (err ERR-INVALID-CAUSE-ID))
)

(define-private (validate-token (token (string-utf8 20)))
  (if (or (is-eq token "STX") (is-eq token "CUSTOM"))
      (ok true)
      (err ERR-INVALID-TOKEN))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-milestone (milestone (optional uint)))
  (ok true)
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-escrow-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set escrow-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-cause-factory-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set cause-factory-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-platform-fee-rate (new-rate uint))
  (begin
    (asserts! (<= new-rate u10) (err ERR-INVALID-FEE-RATE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set platform-fee-rate new-rate)
    (ok true)
  )
)

(define-public (set-min-donation (new-min uint))
  (begin
    (asserts! (> new-min u0) (err ERR-INVALID-MIN-DONATION))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set min-donation new-min)
    (ok true)
  )
)

(define-public (set-max-donation (new-max uint))
  (begin
    (asserts! (> new-max (var-get min-donation)) (err ERR-INVALID-MAX-DONATION))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (var-set max-donation new-max)
    (ok true)
  )
)

(define-public (donate-to-cause (cause-id uint) (amount uint) (token (string-utf8 20)) (milestone (optional uint)))
  (let (
        (next-id (var-get next-donation-id))
        (fee (unwrap! (var-get authority-contract) (err ERR-AUTHORITY-NOT-SET)))
        (escrow (unwrap! (var-get escrow-contract) (err ERR-ESCROW-FAIL)))
        (cause-factory (unwrap! (var-get cause-factory-contract) (err ERR-INVALID-CAUSE-ID)))
        (platform-fee (/ (* amount (var-get platform-fee-rate)) u100))
        (net-amount (- amount platform-fee))
      )
    (asserts! (< next-id (var-get max-donations)) (err ERR-MAX-DONATIONS-EXCEEDED))
    (try! (validate-cause-id cause-id))
    (try! (validate-amount amount))
    (try! (validate-token token))
    (try! (validate-milestone milestone))
    (asserts! (is-ok (contract-call? cause-factory get-cause cause-id)) (err ERR-INVALID-CAUSE-ID))
    (if (is-eq token "STX")
        (begin
          (try! (stx-transfer? platform-fee tx-sender fee))
          (try! (stx-transfer? net-amount tx-sender escrow))
        )
        (ok true)
    )
    (map-set donations next-id
      {
        cause-id: cause-id,
        donor: tx-sender,
        amount: amount,
        token: token,
        timestamp: block-height,
        status: true,
        refunded: false,
        milestone-id: milestone
      }
    )
    (let ((current-total (default-to { total-amount: u0, donor-count: u0 } (map-get? cause-totals cause-id))))
      (map-set cause-totals cause-id
        { total-amount: (+ (get total-amount current-total) net-amount), donor-count: (+ (get donor-count current-total) u1) }
      )
    )
    (var-set next-donation-id (+ next-id u1))
    (print { event: "donation-made", id: next-id, cause-id: cause-id, amount: amount })
    (ok next-id)
  )
)

(define-public (refund-donation (donation-id uint) (reason (string-utf8 100)))
  (let ((donation (map-get? donations donation-id)))
    (match donation
      d
        (begin
          (asserts! (is-eq (get donor d) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get refunded d)) (err ERR-REFUND-NOT-ALLOWED))
          (asserts! (get status d) (err ERR-INVALID-STATUS))
          (let ((escrow (unwrap! (var-get escrow-contract) (err ERR-ESCROW-FAIL))))
            (try! (as-contract (contract-call? escrow release-funds (get cause-id d) (get amount d) tx-sender)))
          )
          (map-set donations donation-id (merge d { refunded: true, status: false }))
          (map-set refunds donation-id { donation-id: donation-id, reason: reason, timestamp: block-height })
          (print { event: "donation-refunded", id: donation-id })
          (ok true)
        )
      (err ERR-INVALID-CAUSE-ID)
    )
  )
)

(define-public (get-donation-count)
  (ok (var-get next-donation-id))
)