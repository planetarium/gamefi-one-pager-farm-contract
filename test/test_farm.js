const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Farm Contract", function () {
    let owner, user1, user2, rewardVault;
    let depositToken, farm;
    const APR = 10;

    beforeEach(async function () {
        // Deploy ERC20 token
        const ERC20 = await ethers.getContractFactory("DEMO");
        depositToken = await ERC20.deploy();
        await depositToken.deployed();

        [owner, user1, user2, rewardVault] = await ethers.getSigners();

        // Deploy Farm contract
        const Farm = await ethers.getContractFactory("Farm");
        farm = await Farm.deploy(depositToken.address, rewardVault.address);
        await farm.deployed();

        // Transfer tokens to reward vault and users
        await depositToken.transfer(rewardVault.address, ethers.utils.parseEther("500000"));
        await depositToken.transfer(user1.address, ethers.utils.parseEther("2000"));
        await depositToken.transfer(user2.address, ethers.utils.parseEther("2000"));
    });

    it("should set correct initial values", async function () {
        expect(await farm.DEPOSIT_TOKEN()).to.equal(depositToken.address);
        expect(await farm.REWARDS_VAULT()).to.equal(rewardVault.address);
        expect(await farm.MAX_USER_DEPOSIT()).to.equal(ethers.utils.parseEther("1000"));
        expect(await farm.MAX_TOTAL_DEPOSIT()).to.equal(ethers.utils.parseEther("50000"));
        expect(await farm.PAUSE_DEPOSIT()).to.equal(false);
    });

    it("should not allow deposit when paused", async function () {
        const depositAmount = ethers.utils.parseEther("500");

        await farm.setPauseDeposit(true);
        await depositToken.connect(user1).approve(farm.address, depositAmount);

        await expect(farm.connect(user1).deposit(depositAmount)).to.be.revertedWith("Deposits are currently paused");

        // Test non-owner trying to set max total deposit
        await expect(
            farm.connect(user1).setPauseDeposit(false)
        ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should update max deposit values and restrict non-owner", async function () {
        // Test setting max user deposit by owner
        const newMaxUserDeposit = ethers.utils.parseEther("2000");
        await farm.connect(owner).setMaxUserDeposit(newMaxUserDeposit);
        expect(await farm.MAX_USER_DEPOSIT()).to.equal(newMaxUserDeposit);

        // Test setting max total deposit by owner
        const newMaxTotalDeposit = ethers.utils.parseEther("100000");
        await farm.connect(owner).setMaxTotalDeposit(newMaxTotalDeposit);
        expect(await farm.MAX_TOTAL_DEPOSIT()).to.equal(newMaxTotalDeposit);

        // Test non-owner trying to set max user deposit
        await expect(
            farm.connect(user1).setMaxUserDeposit(newMaxUserDeposit)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        // Test non-owner trying to set max total deposit
        await expect(
            farm.connect(user1).setMaxTotalDeposit(newMaxTotalDeposit)
        ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should update farm period and restrict non-owner", async function () {
        const currentTime = Math.floor(Date.now() / 1000);
        const newDepositStartTimestamp = currentTime + 3600; // 1 hour later
        const newDepositEndTimestamp = currentTime + 3600 * 24 * 7; // 7 days later
        const newRewardStartTimestamp = currentTime + 3600 * 24 * 2; // 2 days later
        const newRewardEndTimestamp = newDepositEndTimestamp; // Same as deposit end timestamp

        // Test setting deposit period by owner
        await farm.connect(owner).setDepositPeriod(newDepositStartTimestamp, newDepositEndTimestamp);
        expect(await farm.DEPOSIT_START_TIMESTAMP()).to.equal(newDepositStartTimestamp);
        expect(await farm.DEPOSIT_END_TIMESTAMP()).to.equal(newDepositEndTimestamp);

        // Test setting reward period by owner
        await farm.connect(owner).setRewardPeriod(newRewardStartTimestamp, newRewardEndTimestamp);
        expect(await farm.REWARD_START_TIMESTAMP()).to.equal(newRewardStartTimestamp);
        expect(await farm.REWARD_END_TIMESTAMP()).to.equal(newRewardEndTimestamp);

        // Test non-owner trying to set deposit period
        await expect(
            farm.connect(user1).setDepositPeriod(newDepositStartTimestamp, newDepositEndTimestamp)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        // Test non-owner trying to set reward period
        await expect(
            farm.connect(user1).setRewardPeriod(newRewardStartTimestamp, newRewardEndTimestamp)
        ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should transfer reward vault and restrict non-owner", async function () {
        const newVault = user1.address;

        // Test transferring reward vault by owner
        await farm.connect(owner).transferRewardVault(newVault);
        expect(await farm.REWARDS_VAULT()).to.equal(newVault);

        // Test transferring reward vault with zero address
        await expect(
            farm.connect(owner).transferRewardVault(ethers.constants.AddressZero)
        ).to.be.revertedWith("New reward vault cannot be zero address");

        // Test non-owner trying to transfer reward vault
        await expect(
            farm.connect(user1).transferRewardVault(user2.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow deposit and update balances", async function () {
        const currentTime = Math.floor(Date.now() / 1000);
        const depositStartTimestamp = currentTime + 3600; // 1 hour later
        const depositEndTimestamp = currentTime + 3600 * 24 * 7; // 7 days later
        const rewardStartTimestamp = currentTime + 3600 * 24 * 2; // 2 days later
        const rewardEndTimestamp = depositEndTimestamp;

        await farm.connect(owner).setDepositPeriod(depositStartTimestamp, depositEndTimestamp);
        await farm.connect(owner).setRewardPeriod(rewardStartTimestamp, rewardEndTimestamp);

        await network.provider.send("evm_setNextBlockTimestamp", [depositStartTimestamp + 1]); // Move time to within deposit period
        const depositAmount = ethers.utils.parseEther("500");
        await depositToken.connect(user1).approve(farm.address, depositAmount);

        const depositTx = await farm.connect(user1).deposit(depositAmount);

        // event emit check
        const depositReceipt = await depositTx.wait();
        const depositEvent = depositReceipt.events.find((e) => e.event === "Deposit");
        expect(depositEvent.args.user).to.equal(user1.address);
        expect(depositEvent.args.amount).to.equal(depositAmount);

        const userData = await farm.userAssets(user1.address);
        expect(userData.amount).to.equal(depositAmount);

        // TotalDepositAmount check
        expect(await farm.TotalDepositAmount()).to.equal(depositAmount);
    });

    it("should calculate correct rewards", async function () {
        // Reset block.timestamp for this test
        const currentBlockTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
        await ethers.provider.send("evm_setNextBlockTimestamp", [currentBlockTimestamp]);
        await ethers.provider.send("evm_mine");
        const currentTime = currentBlockTimestamp

        const depositStartTimestamp = currentTime + 3600; // 1 hour later
        const depositEndTimestamp = currentTime + 3600 * 24 * 7; // 7 days later
        const rewardStartTimestamp = currentTime + 3600 * 24 * 2; // 2 days later
        const rewardEndTimestamp = depositEndTimestamp;

        await farm.connect(owner).setDepositPeriod(depositStartTimestamp, depositEndTimestamp);
        await farm.connect(owner).setRewardPeriod(rewardStartTimestamp, rewardEndTimestamp);

        await network.provider.send("evm_setNextBlockTimestamp", [depositStartTimestamp + 1]); // Move time to within deposit period
        await network.provider.send("evm_mine");

        const depositAmount = ethers.utils.parseEther("500");
        await depositToken.connect(user1).approve(farm.address, depositAmount);
        await farm.connect(user1).deposit(depositAmount);

        const oneDayInSeconds = 24 * 60 * 60;
        await network.provider.send("evm_setNextBlockTimestamp", [rewardStartTimestamp + oneDayInSeconds]); // Move to reward start + 1 day
        await network.provider.send("evm_mine");

        const reward = await farm.currentReward(user1.address);
        // reward amount should be calculated 1 day reward
        const expectedReward = depositAmount.mul(APR).mul(oneDayInSeconds).div(100).div(365 * 24 * 60 * 60);
        expect(reward).to.equal(expectedReward);
    });

    it("reward should not exceed max reward date range APR", async function () {
        // Reset block.timestamp for this test
        const currentBlockTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
        await ethers.provider.send("evm_setNextBlockTimestamp", [currentBlockTimestamp]);
        await ethers.provider.send("evm_mine");
        const currentTime = currentBlockTimestamp;

        const depositStartTimestamp = currentTime + 3600; // 1 hour later
        const depositEndTimestamp = currentTime + 3600 * 24 * 7; // 7 days later
        const rewardStartTimestamp = currentTime + 3600 * 24 * 2; // 2 days later
        const rewardEndTimestamp = depositEndTimestamp;

        await farm.connect(owner).setDepositPeriod(depositStartTimestamp, depositEndTimestamp);
        await farm.connect(owner).setRewardPeriod(rewardStartTimestamp, rewardEndTimestamp);

        // Move to a time within the deposit period
        await network.provider.send("evm_setNextBlockTimestamp", [depositStartTimestamp + 1]);
        await network.provider.send("evm_mine");

        const depositAmount = ethers.utils.parseEther("500");
        await depositToken.connect(user1).approve(farm.address, depositAmount);
        await farm.connect(user1).deposit(depositAmount);

        // Advance time beyond the reward period (10 days)
        const extraTime = 10 * 24 * 60 * 60; // 10 days
        const postRewardEndTimestamp = rewardEndTimestamp + extraTime;
        await ethers.provider.send("evm_setNextBlockTimestamp", [postRewardEndTimestamp]);
        await ethers.provider.send("evm_mine");

        // Rewards only for 5 days (rewardStartTimestamp to rewardEndTimestamp)
        const reward = await farm.currentReward(user1.address);
        const maxReward = depositAmount.mul(APR).mul(5 * 24 * 60 * 60).div(100).div(365 * 24 * 60 * 60);

        expect(reward.lte(maxReward)).to.be.true;
    });

    it("should allow withdrawal and reset user data", async function () {
        const currentBlockTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
        await ethers.provider.send("evm_setNextBlockTimestamp", [currentBlockTimestamp]);
        await ethers.provider.send("evm_mine");
        const currentTime = currentBlockTimestamp;

        const depositStartTimestamp = currentTime - 100; // Start slightly before current time
        const depositEndTimestamp = currentTime + 3600 * 24 * 7; // 7 days later
        const rewardStartTimestamp = currentTime + 3600 * 24 * 2; // 2 days later
        const rewardEndTimestamp = depositEndTimestamp;

        await farm.connect(owner).setDepositPeriod(depositStartTimestamp, depositEndTimestamp);
        await farm.connect(owner).setRewardPeriod(rewardStartTimestamp, rewardEndTimestamp);

        const approveAmount = ethers.utils.parseEther("1000");
        const depositAmount = ethers.utils.parseEther("500");

        await depositToken.connect(user1).approve(farm.address, approveAmount);
        await farm.connect(user1).deposit(depositAmount);

        const beforeWithDrawBalance = await depositToken.balanceOf(user1.address);

        const oneDayInSeconds = 24 * 60 * 60;
        await ethers.provider.send("evm_increaseTime", [rewardStartTimestamp + oneDayInSeconds]);
        await ethers.provider.send("evm_mine");

        await depositToken.connect(rewardVault).approve(farm.address, approveAmount);

        const withdrawTx = await farm.connect(user1).withdraw();
        const withdrawReceipt = await withdrawTx.wait();
        const withdrawEvent = withdrawReceipt.events.find((e) => e.event === "Withdraw");

        expect(withdrawEvent.args.user).to.equal(user1.address);
        expect(withdrawEvent.args.depositAmount).to.equal(depositAmount);

        // currnet balance = beforeWithDrawBalance + depositAmount + rewardAmount ( 1 day reward )
        expect(await depositToken.balanceOf(user1.address))
            .to.equal(beforeWithDrawBalance.add(depositAmount.add(withdrawEvent.args.rewardAmount)));

        const userData = await farm.userAssets(user1.address);
        expect(userData.amount).to.equal(0);
        expect(await farm.TotalDepositAmount()).to.equal(0);
    });


    it("should transfer user assets by owner and restrict non-owner", async function () {
        const currentBlockTimestamp = (await ethers.provider.getBlock("latest")).timestamp + 1;
        await ethers.provider.send("evm_setNextBlockTimestamp", [currentBlockTimestamp]);
        await ethers.provider.send("evm_mine");
        const currentTime = currentBlockTimestamp;

        const depositStartTimestamp = currentTime - 100; // Start slightly before current time
        const depositEndTimestamp = currentTime + 3600 * 24 * 7; // 7 days later
        const rewardStartTimestamp = currentTime + 3600 * 24 * 2; // 2 days later
        const rewardEndTimestamp = depositEndTimestamp;

        await farm.connect(owner).setDepositPeriod(depositStartTimestamp, depositEndTimestamp);
        await farm.connect(owner).setRewardPeriod(rewardStartTimestamp, rewardEndTimestamp);

        const depositAmount = ethers.utils.parseEther("500");
        const approveAmount = ethers.utils.parseEther("1000");
        await depositToken.connect(user1).approve(farm.address, approveAmount);

        // Deposit assets for user1
        await farm.connect(user1).deposit(depositAmount);

        // Increase time to calculate reward
        const oneDayInSeconds = 24 * 60 * 60;
        await ethers.provider.send("evm_increaseTime", [rewardStartTimestamp + oneDayInSeconds]);
        await ethers.provider.send("evm_mine");

        await depositToken.connect(rewardVault).approve(farm.address, approveAmount);

        // Test transferring assets by owner
        const transferTx = await farm.connect(owner).transferAssetByOwner(user1.address);
        const transferReceipt = await transferTx.wait();
        const transferEvent = transferReceipt.events.find((e) => e.event === "AssetTransferred");

        expect(await farm.TotalDepositAmount()).to.equal(0);

        // Check event data
        expect(transferEvent.args.recipient).to.equal(user1.address);
        expect(transferEvent.args.amount).to.equal(depositAmount);
        expect(transferEvent.args.reward).to.be.gt(0); //  reward sholud be greater than 0

        const userData = await farm.userAssets(user1.address);
        expect(userData.amount).to.equal(0);

        // Test transferring assets when recipient has no deposit
        await expect(
            farm.connect(owner).transferAssetByOwner(user1.address)
        ).to.be.revertedWith("Recipient has no deposit");

        // Test transferring assets to zero address
        await expect(
            farm.connect(owner).transferAssetByOwner(ethers.constants.AddressZero)
        ).to.be.revertedWith("Recipient address cannot be zero");

        // Test transferring assets with insufficient balance in contract
        await depositToken.connect(owner).transfer(user2.address, await depositToken.balanceOf(owner.address)); // Empty contract balance

        await expect(
            farm.connect(owner).transferAssetByOwner(user2.address)
        ).to.be.revertedWith("Recipient has no deposit");

        // Test non-owner trying to transfer assets
        await expect(
            farm.connect(user1).transferAssetByOwner(user2.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should validate deposit conditions", async function () {
        const currentBlockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
        // Set deposit period and approve token
        const depositStartTimestamp = currentBlockTimestamp + 3600; // 1 hour later
        const depositEndTimestamp = currentBlockTimestamp + 3600 * 24 * 7; // 7 days later
        await farm.connect(owner).setDepositPeriod(depositStartTimestamp, depositEndTimestamp);

        const depositAmount = ethers.utils.parseEther("500");
        const approveAmount = ethers.utils.parseEther("2000");
        await depositToken.connect(user1).approve(farm.address, approveAmount);
        await depositToken.connect(user2).approve(farm.address, approveAmount);

        // Test deposit before the start time
        await expect(
            farm.connect(user1).deposit(depositAmount)
        ).to.be.revertedWith("Deposit not allowed at this time");

        // Move to deposit period and deposit
        await ethers.provider.send("evm_setNextBlockTimestamp", [depositStartTimestamp + 1]);
        await ethers.provider.send("evm_mine");
        await farm.connect(user1).deposit(depositAmount);

        // Test exceeding max user deposit
        const exceedUserDeposit = ethers.utils.parseEther("600");
        await expect(
            farm.connect(user1).deposit(exceedUserDeposit)
        ).to.be.revertedWith("Exceeds maximum deposit per user");

        const invalidDepositAmount = ethers.utils.parseEther("0");
        await expect(
            farm.connect(user2).deposit(invalidDepositAmount)
        ).to.be.revertedWith("Amount must be greater than 0 (in wei)");

        // Test exceeding max total deposit
        const newUserDeposit = ethers.utils.parseEther("700");
        await farm.connect(owner).setMaxTotalDeposit(depositAmount.mul(2)); // Set lower total deposit limit
        await expect(
            farm.connect(user2).deposit(newUserDeposit)
        ).to.be.revertedWith("Exceeds maximum total deposit");

        // Test deposits when paused
        await farm.connect(owner).setPauseDeposit(true);
        await expect(
            farm.connect(user1).deposit(depositAmount)
        ).to.be.revertedWith("Deposits are currently paused");
    });
});
