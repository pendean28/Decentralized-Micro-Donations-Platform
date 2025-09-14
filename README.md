# 🌟 Decentralized Micro-Donations Platform

Welcome to a revolutionary way to support small local causes through micro-donations on the blockchain! This project empowers individuals and communities to fund grassroots initiatives with tiny, frequent contributions, ensuring transparency, low fees, and direct impact using the Stacks blockchain.

## ✨ Features

🔄 Create and manage local causes with verifiable goals  
💸 Make micro-donations in STX or custom tokens starting from fractions of a cent  
📊 Track donation progress and fund usage in real-time on-chain  
🗳 Community voting to approve and prioritize causes  
🏆 Reward donors with badges or NFTs for participation  
🔒 Secure escrow for milestone-based fund releases  
🚫 Fraud prevention through on-chain verification and refunds  
📈 Analytics for cause performance and donor impact reports  

## 🛠 How It Works

**For Cause Creators**  
- Register your profile and create a cause with details like location, goals, and milestones.  
- Set up donation targets and optional voting periods.  
- Once approved by community votes, receive micro-donations held in escrow.  
- Release funds upon verifiable milestone achievements (e.g., upload proof hashed on-chain).  

**For Donors**  
- Browse active causes and make instant micro-donations.  
- Vote on new causes to help them get featured.  
- Earn rewards like donor badges for consistent contributions.  
- Track your impact and request refunds if a cause fails milestones.  

**For Verifiers/Community**  
- Use on-chain tools to verify cause legitimacy and progress.  
- View transparent donation flows and analytics.  

That's it! Empower local change with seamless, trustless micro-giving.

## 📜 Smart Contracts Overview

This project leverages 8 Clarity smart contracts on the Stacks blockchain for a robust, decentralized system:  

1. **UserRegistry.clar**: Handles user registration, profiles, and authentication to prevent sybil attacks.  
2. **CauseFactory.clar**: Allows creation of new causes with metadata (title, description, location, goals).  
3. **DonationHandler.clar**: Processes micro-donations, tracks totals, and integrates with STX or fungible tokens.  
4. **VotingMechanism.clar**: Enables community voting on cause approvals and prioritizations using token-weighted votes.  
5. **EscrowVault.clar**: Secures donated funds in escrow, releasing them only upon milestone verifications.  
6. **RewardDistributor.clar**: Issues NFTs or badges to donors based on contribution levels.  
7. **VerificationOracle.clar**: Stores hashed proofs for milestones and handles dispute resolutions.  
8. **AnalyticsTracker.clar**: Maintains on-chain counters and events for donation stats and impact reporting.  

These contracts interact seamlessly to solve real-world issues like high donation fees, lack of transparency in fund usage, and barriers for small causes to access funding—making philanthropy accessible and accountable for everyone.