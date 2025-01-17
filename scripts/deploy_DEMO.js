const { ethers, upgrades } = require("hardhat");

async function main() {
  const contractName = "DEMO";
  const DEMO = await ethers.getContractFactory(contractName);
  const x = await DEMO.deploy();
  await x.deployed();
  console.log(contractName, "deployed to:", x.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
