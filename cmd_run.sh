npx hardhat run scripts/deploy_farm.js --network bsc_testnet
npx hardhat run scripts/deploy_DEMO.js --network bsc_testnet
npx hardhat verify --network bsc_testnet 0x3f2C77a739E58e80020E6B3D90940507f7b82918

npx hardhat run scripts/deploy_DEMO.js --network base_testnet
npx hardhat verify --network base_testnet 0x462B41cE373A54Fe440CB943c7B6E68d652cEaB7
npx hardhat run scripts/deploy_farm.js --network base_testnet

npx hardhat run scripts/deploy_DEMO.js --network celo_testnet
npx hardhat verify --network celo_testnet 0xF844B1537d49e53525221361d474c9100aE4bD79
npx hardhat run scripts/deploy_farm.js --network celo_testnet



npx hardhat run scripts/deploy_farm.js --network bsc_mainnet

npx hardhat run scripts/deploy_farm6decimal.js --network base_mainnet

npx hardhat run scripts/deploy_farm6decimal.js --network celo_mainnet
