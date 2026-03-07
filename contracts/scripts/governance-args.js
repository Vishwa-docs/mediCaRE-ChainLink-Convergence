// Constructor arguments for Governance contract verification
const { ethers } = require("hardhat");

module.exports = [
  "0x7637B8d8F46990441420343A7660436eD69c3716",  // admin
  "0x7Cf6cb620c2617887DC0Df5Faf8b14A984404f98",  // govToken (MockStablecoin)
  ethers.parseUnits("100", 18),                    // proposalThreshold
  ethers.parseUnits("1000", 18),                   // quorumVotes
  259200,                                          // votingPeriod (3 days)
  86400,                                           // executionDelay (1 day)
];
