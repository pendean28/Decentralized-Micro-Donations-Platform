import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_CAUSE_ID = 101;
const ERR_INVALID_AMOUNT = 102;
const ERR_INVALID_TOKEN = 103;
const ERR_MAX_DONATIONS_EXCEEDED = 109;
const ERR_INVALID_FEE_RATE = 110;
const ERR_INVALID_MIN_DONATION = 111;
const ERR_INVALID_MAX_DONATION = 112;
const ERR_AUTHORITY_NOT_SET = 119;
const ERR_ESCROW_FAIL = 117;
const ERR_REFUND_NOT_ALLOWED = 106;
const ERR_INVALID_STATUS = 113;

interface Donation {
  causeId: number;
  donor: string;
  amount: number;
  token: string;
  timestamp: number;
  status: boolean;
  refunded: boolean;
  milestoneId: number | null;
}

interface CauseTotal {
  totalAmount: number;
  donorCount: number;
}

interface Refund {
  donationId: number;
  reason: string;
  timestamp: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class DonationHandlerMock {
  state: {
    nextDonationId: number;
    maxDonations: number;
    platformFeeRate: number;
    minDonation: number;
    maxDonation: number;
    authorityContract: string | null;
    escrowContract: string | null;
    causeFactoryContract: string | null;
    donations: Map<number, Donation>;
    causeTotals: Map<number, CauseTotal>;
    refunds: Map<number, Refund>;
  } = {
    nextDonationId: 0,
    maxDonations: 10000,
    platformFeeRate: 5,
    minDonation: 1,
    maxDonation: 1000000,
    authorityContract: null,
    escrowContract: null,
    causeFactoryContract: null,
    donations: new Map(),
    causeTotals: new Map(),
    refunds: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];
  contractCalls: Array<{ contract: string; method: string; args: any[] }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextDonationId: 0,
      maxDonations: 10000,
      platformFeeRate: 5,
      minDonation: 1,
      maxDonation: 1000000,
      authorityContract: null,
      escrowContract: null,
      causeFactoryContract: null,
      donations: new Map(),
      causeTotals: new Map(),
      refunds: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.contractCalls = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setEscrowContract(contractPrincipal: string): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: false };
    this.state.escrowContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCauseFactoryContract(contractPrincipal: string): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: false };
    this.state.causeFactoryContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setPlatformFeeRate(newRate: number): Result<boolean> {
    if (newRate > 10) return { ok: false, value: ERR_INVALID_FEE_RATE };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.platformFeeRate = newRate;
    return { ok: true, value: true };
  }

  setMinDonation(newMin: number): Result<boolean> {
    if (newMin <= 0) return { ok: false, value: ERR_INVALID_MIN_DONATION };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.minDonation = newMin;
    return { ok: true, value: true };
  }

  setMaxDonation(newMax: number): Result<boolean> {
    if (newMax <= this.state.minDonation) return { ok: false, value: ERR_INVALID_MAX_DONATION };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.maxDonation = newMax;
    return { ok: true, value: true };
  }

  donateToCause(causeId: number, amount: number, token: string, milestone: number | null): Result<number> {
    if (this.state.nextDonationId >= this.state.maxDonations) return { ok: false, value: ERR_MAX_DONATIONS_EXCEEDED };
    if (causeId <= 0) return { ok: false, value: ERR_INVALID_CAUSE_ID };
    if (amount < this.state.minDonation || amount > this.state.maxDonation) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (!["STX", "CUSTOM"].includes(token)) return { ok: false, value: ERR_INVALID_TOKEN };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    if (!this.state.escrowContract) return { ok: false, value: ERR_ESCROW_FAIL };
    if (!this.state.causeFactoryContract) return { ok: false, value: ERR_INVALID_CAUSE_ID };

    const platformFee = Math.floor((amount * this.state.platformFeeRate) / 100);
    const netAmount = amount - platformFee;

    if (token === "STX") {
      this.stxTransfers.push({ amount: platformFee, from: this.caller, to: this.state.authorityContract });
      this.stxTransfers.push({ amount: netAmount, from: this.caller, to: this.state.escrowContract });
    }

    const id = this.state.nextDonationId;
    const donation: Donation = {
      causeId,
      donor: this.caller,
      amount,
      token,
      timestamp: this.blockHeight,
      status: true,
      refunded: false,
      milestoneId: milestone,
    };
    this.state.donations.set(id, donation);
    const currentTotal = this.state.causeTotals.get(causeId) || { totalAmount: 0, donorCount: 0 };
    this.state.causeTotals.set(causeId, {
      totalAmount: currentTotal.totalAmount + netAmount,
      donorCount: currentTotal.donorCount + 1,
    });
    this.state.nextDonationId++;
    return { ok: true, value: id };
  }

  getDonation(id: number): Donation | null {
    return this.state.donations.get(id) || null;
  }

  getCauseTotal(causeId: number): CauseTotal | null {
    return this.state.causeTotals.get(causeId) || null;
  }

  refundDonation(donationId: number, reason: string): Result<boolean> {
    const donation = this.state.donations.get(donationId);
    if (!donation) return { ok: false, value: false };
    if (donation.donor !== this.caller) return { ok: false, value: false };
    if (donation.refunded) return { ok: false, value: ERR_REFUND_NOT_ALLOWED };
    if (!donation.status) return { ok: false, value: ERR_INVALID_STATUS };
    if (!this.state.escrowContract) return { ok: false, value: ERR_ESCROW_FAIL };

    this.contractCalls.push({ contract: this.state.escrowContract, method: "release-funds", args: [donation.causeId, donation.amount, this.caller] });

    this.state.donations.set(donationId, { ...donation, refunded: true, status: false });
    this.state.refunds.set(donationId, { donationId, reason, timestamp: this.blockHeight });
    return { ok: true, value: true };
  }

  getRefund(id: number): Refund | null {
    return this.state.refunds.get(id) || null;
  }

  getDonationCount(): Result<number> {
    return { ok: true, value: this.state.nextDonationId };
  }
}

describe("DonationHandler", () => {
  let contract: DonationHandlerMock;

  beforeEach(() => {
    contract = new DonationHandlerMock();
    contract.reset();
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("sets escrow contract successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    const result = contract.setEscrowContract("ST3ESCROW");
    expect(result.ok).toBe(true);
    expect(contract.state.escrowContract).toBe("ST3ESCROW");
  });

  it("sets cause factory contract successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    const result = contract.setCauseFactoryContract("ST4CAUSE");
    expect(result.ok).toBe(true);
    expect(contract.state.causeFactoryContract).toBe("ST4CAUSE");
  });

  it("sets platform fee rate successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    const result = contract.setPlatformFeeRate(3);
    expect(result.ok).toBe(true);
    expect(contract.state.platformFeeRate).toBe(3);
  });

  it("sets min donation successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    const result = contract.setMinDonation(10);
    expect(result.ok).toBe(true);
    expect(contract.state.minDonation).toBe(10);
  });

  it("sets max donation successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    const result = contract.setMaxDonation(500000);
    expect(result.ok).toBe(true);
    expect(contract.state.maxDonation).toBe(500000);
  });

  it("makes a donation successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    contract.setEscrowContract("ST3ESCROW");
    contract.setCauseFactoryContract("ST4CAUSE");
    contract.caller = "ST1TEST";
    const result = contract.donateToCause(1, 100, "STX", null);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const donation = contract.getDonation(0);
    expect(donation?.causeId).toBe(1);
    expect(donation?.amount).toBe(100);
    expect(donation?.token).toBe("STX");
    expect(contract.stxTransfers).toEqual([
      { amount: 5, from: "ST1TEST", to: "ST2TEST" },
      { amount: 95, from: "ST1TEST", to: "ST3ESCROW" },
    ]);
    const total = contract.getCauseTotal(1);
    expect(total?.totalAmount).toBe(95);
    expect(total?.donorCount).toBe(1);
  });

  it("refunds a donation successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    contract.setEscrowContract("ST3ESCROW");
    contract.setCauseFactoryContract("ST4CAUSE");
    contract.caller = "ST1TEST";
    contract.donateToCause(1, 100, "STX", null);
    const result = contract.refundDonation(0, "Changed mind");
    expect(result.ok).toBe(true);
    const donation = contract.getDonation(0);
    expect(donation?.refunded).toBe(true);
    expect(donation?.status).toBe(false);
    const refund = contract.getRefund(0);
    expect(refund?.reason).toBe("Changed mind");
    expect(contract.contractCalls).toEqual([
      { contract: "ST3ESCROW", method: "release-funds", args: [1, 100, "ST1TEST"] },
    ]);
  });

  it("rejects donation without authority set", () => {
    const result = contract.donateToCause(1, 100, "STX", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_SET);
  });

  it("rejects invalid amount", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    contract.setEscrowContract("ST3ESCROW");
    contract.setCauseFactoryContract("ST4CAUSE");
    contract.caller = "ST1TEST";
    const result = contract.donateToCause(1, 0, "STX", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("rejects invalid token", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    contract.setEscrowContract("ST3ESCROW");
    contract.setCauseFactoryContract("ST4CAUSE");
    contract.caller = "ST1TEST";
    const result = contract.donateToCause(1, 100, "INVALID", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TOKEN);
  });

  it("rejects refund for non-donor", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    contract.setEscrowContract("ST3ESCROW");
    contract.setCauseFactoryContract("ST4CAUSE");
    contract.caller = "ST1TEST";
    contract.donateToCause(1, 100, "STX", null);
    contract.caller = "ST5OTHER";
    const result = contract.refundDonation(0, "Test");
    expect(result.ok).toBe(false);
  });

  it("rejects refund if already refunded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    contract.setEscrowContract("ST3ESCROW");
    contract.setCauseFactoryContract("ST4CAUSE");
    contract.caller = "ST1TEST";
    contract.donateToCause(1, 100, "STX", null);
    contract.refundDonation(0, "Test");
    const result = contract.refundDonation(0, "Again");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REFUND_NOT_ALLOWED);
  });

  it("gets donation count correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    contract.setEscrowContract("ST3ESCROW");
    contract.setCauseFactoryContract("ST4CAUSE");
    contract.caller = "ST1TEST";
    contract.donateToCause(1, 100, "STX", null);
    contract.donateToCause(2, 200, "CUSTOM", 1);
    const result = contract.getDonationCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("parses parameters with Clarity types", () => {
    const token = stringUtf8CV("STX");
    const amount = uintCV(100);
    expect(token.value).toBe("STX");
    expect(amount.value).toEqual(BigInt(100));
  });

  it("rejects max donations exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2TEST";
    contract.setEscrowContract("ST3ESCROW");
    contract.setCauseFactoryContract("ST4CAUSE");
    contract.caller = "ST1TEST";
    contract.state.maxDonations = 1;
    contract.donateToCause(1, 100, "STX", null);
    const result = contract.donateToCause(2, 200, "STX", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_DONATIONS_EXCEEDED);
  });
});