const { ethers, upgrades, run } = require("hardhat");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    // Compile contracts if needed
    console.log("Deploying FARM contract...");

    // Deployment parameters
    const depositTokenAddress = "0x55d398326f99059fF775485246999027B3197955"; // Replace with actual ERC20 token address

    // mainnet
    const rewardsVaultAddress = "0x83de5Ad1f7ef743877F808092e615B4777B6dAAD"; // Replace with actual reward vault address

    // Get the contract factory
    const farm = await ethers.getContractFactory("Farm");

    // Deploy the contract
    const farmContract = await farm.deploy(depositTokenAddress, rewardsVaultAddress);

    // Wait for the deployment to complete
    await farmContract.deployed();

    console.log(`farmContract deployed to: ${farmContract.address}`);

    // Sleep for 10 seconds before verifying the contract
    console.log("Waiting for 10 seconds before verifying contract...");
    await sleep(20000);

    // Verify the contract on block explorer
    console.log("Verifying contract on block explorer...");
    try {
        await run("verify:verify", {
            address: farmContract.address,
            constructorArguments: [depositTokenAddress, rewardsVaultAddress],
            contract: "contracts/farm.sol:Farm"
        });
        console.log("Contract verified successfully!");
    } catch (error) {
        console.error("Error verifying contract:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
