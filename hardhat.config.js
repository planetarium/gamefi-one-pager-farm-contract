require('@nomiclabs/hardhat-waffle');
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@openzeppelin/hardhat-upgrades");
require('hardhat-contract-sizer');
require('hardhat-docgen');
require('solidity-coverage')
require("dotenv").config({ path: "./.env" })
require('hardhat-abi-exporter');

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

function getPrivateKey(networkName) {
  if (networkName) {
    const privateKey = process.env['PRIVATE_KEY_' + networkName.toUpperCase()];
    if (privateKey && privateKey !== '') {
      return privateKey;
    }
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey === '') {
    return 'notsecureprivatekey'
  }

  return privateKey;
}

module.exports = {
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true
        }
      },
      viaIR : false
    },
  },
  networks: {
    bsc_testnet: {
      url: "https://data-seed-prebsc-1-s2.binance.org:8545",
      chainId: 97,
      accounts: [getPrivateKey('bsc_testnet')],
    },
    bsc_mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [getPrivateKey('bsc_mainnet')],
    },
    base_testnet: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: [getPrivateKey('base_testnet')],
    },
    base_mainnet: {
      url: "https://mainnet.base.org",
      chainId: 8453,
      accounts: [getPrivateKey('base_mainnet')],
    },
    celo_testnet: {
      url: "https://alfajores-forno.celo-testnet.org",
      chainId: 44787,
      accounts: [getPrivateKey('celo_testnet')],
    },
    celo_mainnet: {
      url: "https://forno.celo.org",
      chainId: 42220,
      accounts: [getPrivateKey('celo_mainnet')],
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: process.env.BSCSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      bsc_mainnet: process.env.BSCSCAN_API_KEY,
      base_testnet: process.env.BASESCAN_API_KEY,
      base_mainnet: process.env.BASESCAN_API_KEY,
      celo_testnet: process.env.CELOSCAN_API_KEY,
      celo_mainnet: process.env.CELOSCAN_API_KEY
    },
    customChains: [
      {
        network: 'base_testnet',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
      {
        network: 'base_mainnet',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
      {
        network: 'celo_testnet',
        chainId: 44787,
        urls: {
          apiURL: 'https://api-alfajores.celoscan.io/api',
          browserURL: 'https://alfajores.celoscan.io',
        },
      },
      {
        network: 'celo_mainnet',
        chainId: 42220,
        urls: {
          apiURL: 'https://api.celoscan.io/api',
          browserURL: 'https://celoscan.io',
        },
      },
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: true,
  },
  abiExporter: [
    {
      path: './abi/json',
      format: "json",
    },
    {
      path: './abi/minimal',
      format: "minimal",
    },
    {
      path: './abi/fullName',
      format: "fullName",
    },
  ]
};
