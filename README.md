<h3 align="center">ERD Token (ERC-20) Staking Smart Contract</h3>

# Glossary
ERD: ERC20 Ethereum mainnet token, 18 decimal places

EWEI: Subdivision of ERD, 1 ERD = 10 ^ 18 EWEI

# Justification
Before the launch of the mainnet, Elrond will give the option to all ERD holders to pre-stake their ERD in a smart contract
(deployed on Ethereum blockchain). In this pre-staking phase there will be no need to run any validators nodes. But for 
locking up their ERDs on-chain, token holders will earn rewards for supporting the Elrond network and the mainnet launch 
by showing their intention to stake or delegate their ERD in the future.

# Abstract
There will be a limited amount of ERD that will be accepted for staking: 5 000 000 000 ERD (around 50% of the 
circulating supply at 4th of January 2020). Still, not all 5 Billion ERD will be available to be pre-staked from the 
beginning. On day one there will be 500 Million ERD available only. At the end of the third day, an additional 500
Million ERD will be accepted for pre-staking. At the end of the 6th day another 500 Million ERD, and so on. 
After 27 days, all 5 Billion will be available to be pre-staked.

We are mainly taking this 10 waves approach to have a better control in terms of liquidity since most of the ERD tokens 
are BEP2 right now and we will need to convert them to ERC20 (burn ERD BEP2 and mint ERD ERC20). 
For any ERD token holder this conversion will be done seamlessly by just sending his ERD BEP2 to his Binance account, 
if they are not already there, and withdraw them as an ERD ERC20 to any Ethereum compatible wallet, bu we recommend Metamask, 
and/or Ledger if staking is also an option. 

Until 3 days after the 10th wave, so basically for 30 days since the smart contract becomes active, 
no withdrawal will be permitted. After those initial 30 days, withdrawals will be permitted but they will not be 
instant, but (to mimic the un-staking period that Elrond will have at mainnet), any withdrawal will be actually 
executed only after a 7-days period from the time it was initiated. Once a withdrawal is executed, 
a transaction will send to the owner address the initial amount and all the rewards earned until the 
withdrawal was initiated (so no rewards for the last 7 days since the withdrawal was initiated).

For all and for any amount of ERD pre-staked, there will be a reward for each full day the ERD were staked, until the day 
a withdrawal was initiated or until the last day rewards were enabled in the Smart Contract. The initial reward rate 
will be 17% per year (annualized). However, depending on how much is staked the reward rate will increase by 2% for 
each 1.25 Billion ERD staked (25% from the maximum allowed of 5 Billion):

0 - 1.25 Billion staked: 		17% annual reward rate

1.25 Billion - 2.5 Billion staked: 	19% annual reward rate

2.5 Billion - 3.75 Billion staked: 	21 % annual reward rate

3.75 Billion - 5 Billion staked: 		22% annual reward rate

In addition to the above shared incentive between all who are pre-staking, we also are going to apply an individual 
bonus for each amount stake, a 0.5% increase to the rewards rate for each full day the amount stake is not withdrawn, 
whatever the reward rate will be for each day, 17%, 19%, 21% or 23%. So for example if on day one the reward rate is 
17% on the next day will be increased with 0.085% and on the next day with an additional 0.085% and so on. An online calculator
is avilable here: https://docs.google.com/spreadsheets/d/1aE0DzDU4HgA3TVWRJxvsEKlOEdn57KkBEADbx2DZaaA/edit#gid=42242207

We are expecting the Smart Contract to calculate and have rewards enabled for around 3 months. However, there will be a
maximum of rewards the SC will support, 400 Million ERD.

However, if at any time before this maximum is reached, Elrond, at its own discretion, can choose to disable the 
rewards to be further calculated, announcing this change through all public available channels and giving enough time 
for everybody to prepare to claim their rewards and ERD. Disabling the rewards will just disable any future rewards 
from the time it was executed; all past rewards will not be affected and anyone will be able to claim them afterwards.


# Specification
## Time constrained staking
The maximum total staking amount for all stakers is 5 000 000 000 ERD, this cap is 500 000 000 ERD in day one and 
will increase with a 500 000 000 increment once every 3 days for 27 days resulting in this formula: 

Max staking Amount = 30/3 days * 500 000 000 ERD = 5 000 000 000 ERD

### Increments
- Between n and n+1, there will be 3 days

### Conditions:

- Max n = 10
= Max 30 days
- Max ERD amount = 5 000 000 000 (5 * 10^9)
- There are no dependencies between the waves, if the 500 M are not met from a previous wave the increment still happens

### Timeline example:
- C0 = 500 M ERD
- C1 = C0 + 500 M ERD
- C2 = C1 + 500 M ERD
...
- Cn = C(n-1) + 500 M ERD

For n=10: C10 = 500 M * 9 + 500 M = 500 M * 10 = 5 000 000 000 (Billion) ERD

* C = Cap

## Withdrawal

### Phases

1. Initiating withdrawal

Description:
- The user will call the initiateWithdrawal function which will register the current date time. 

Conditions:
- After minimum 30 days from the 1st wave


2. Execution of withdrawal
	
Description:
- To be done manually using the pull method (they initiate the transaction) and not the push method (we initiate the transaction via an off-chain service).
- Will compute the rewards and transfer the initially staked ERD + rewards
	
Conditions:
- A withdrawal initiation should exist on the requesting address
- From the withdrawal initiation should have passed at least 7 days (strictly larger)
- There is no beneficiary address that will receive the ERD, the msg.sender will receive the funds

# Rewards

The period between initiating withdrawal and executing the withdrawal will not be taken into consideration when calculating the reward

## Terms

- Base reward (BRn)
  - Dependent on the total staked amount in the contract at a particular moment
  - It’s applied per year, we will take this reward and divide it by 365
- Stake amount (S)
  - Amount of ERD staked by the User
- Multiplier (M)
  - It’s 1% of the Base Reward added each day while the user has stake
- Withdrawn Quantity (WQ)
- Stake period (SP)
  - Expressed in days
  - Number of days the ERD were staked in the contract
  
## Formula

Reward = Stake * Reward rate

Reward rate = Weighted average + Accumulator

Weighted average = Weighted sum / Staking period

Accumulator = Weighted sum * Multiplier / 100

Glossary:
- Weighted sum: each (Annual reward rate * Number of days staking period) added together for all periods of staking.
- Weighted average: Weighted sum / Staking period

# Certification

The staking contract has been thouroughly tested and reviewed by .... and .... .

Full audit report: 
- [insert link]
- [insert link]

# Deployed Contract

The current version of the contract has been deployed on the Ethereum mainnet and can be found under this address: [insert link]. As a consequence all staking actions and withdrawals will be publicly observable and fully verifiable. If the contract address displayed during staking or withdrawals should ever deviate from this address it is a sign of the website being either fake or compromised. In that case DO NOT INTERACT WITH THE WEBSITE.

# Bug Reporting

Please contact us at bugbounty@elrond.com if you find something you believe we should know about.
