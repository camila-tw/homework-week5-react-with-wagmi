import './App.css';
import { useAccount, useConnect, useNetwork, chain, useDisconnect, useContractRead, useContractWrite} from "wagmi";
import React, { useEffect, useState } from 'react';
import { contractABI, contractAddress } from "./configs/contract.js";
import {ethers} from "ethers";

function App() {
  const { connect, connectors, isConnecting, pendingConnector} = useConnect();
  const { data: account} = useAccount();
  const { activeChain, switchNetwork } = useNetwork( { chainId: chain.rinkeby.id });
  const { disconnect } = useDisconnect();
  const [ addAddress, setWhitelistAddress] = React.useState(null);

  /**
   * @dev 合約互動：查詢已鑄造數量
   */
  const { data: totalSupply} = useContractRead(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    'totalSupply',
    { watch: true},
  );

   /**
   * @dev 合約互動：查詢帳戶餘額
   */
  const { data: accountBalance } = useContractRead(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    "balanceOf",
    {
      args: [account?.address],
      watch: true,
    }
  );

   /**
   * @dev 合約互動：查詢剩餘可鑄造
   */
   const { data: mintableCount} = useContractRead(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    'mintableCount',
    { watch: true},
  );

   /**
   * @dev 合約互動：查詢發行總量
   */
   const { data: maxMintCount} = useContractRead(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    'maxMintCount'
  );

  /**
   * @dev 合約互動：查詢是否在白名單
   */
   const { data: checkIsInWhitelist} = useContractRead(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    'isInWhitelist',
    {
      args: [account?.address],
      watch: true,
    }
  );

  const isAddressMintable = () => {
    if (isOwner()) {
      return true;
    }
    return checkIsInWhitelist;
  };

   /**
   * @dev 合約互動：添加白名單
   */
   const { write:addToWhitelist } = useContractWrite(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    'addToWhitelist',
    {
      args: [addAddress],
    }
  );
  
  const addAddressToWhitelistButtonClick = () => {
    addToWhitelist();
  };

  /**
   * @dev 合約互動：查詢售價
   */
   const { data: sellPrice} = useContractRead(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    'sellPrice'
  );

  /**
   * @dev 合約互動：查詢合約擁有者
   */
   const { data: ownerAddress} = useContractRead(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    'owner',
    {
      watch: true,
    }
  );

  const price = (sellPrice) ? ethers.utils.formatEther(sellPrice) : 0;

   /**
   * @dev 合約互動：鑄造NFT
   */
   const { write: mint, isLoading: isMintLoading} = useContractWrite(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    'mint',
    {
      overrides: {
        value: price ? ethers.utils.parseEther(price?.toString()) : null,
      },
    }
  );
  const startMintNFT = () => { mint() };

 

  const getSellStartTime = () => {
    let today = new Date();
    today.setSeconds(today.getSeconds() + 20); // add 10 seconds
    return Math.round(today.getTime() / 1000); // unix timestamp
  };

   /**
   * @dev 合約互動：設置開始銷售時間
   */
   const { write: setSaleStartTime } = useContractWrite(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    'setSaleStartTime',
    {
      args:[getSellStartTime()]
    }
  );
  const setStartSellTime = () => {
    setSaleStartTime();
  };

  /**
   * @dev 合約互動：查詢銷售開始時間
   */
   const { data: saleStartTime} = useContractRead(
    {
      addressOrName: contractAddress,
      contractInterface: contractABI,
    },
    'saleStartTime',
    {
      watch: true,
    }
  );
  
  const [sellTimer, setSellTimer] = useState(0);
  useEffect(
    () => {
      const id = setInterval(() => {
        const dateTime = Date.now();
        const timestamp = Math.floor(dateTime / 1000);
        const minus = saleStartTime.sub(ethers.BigNumber.from(timestamp)).toString()
        setSellTimer(minus)
      }, 1000);

      return () => {
        clearInterval(id);
      };
    },
    [saleStartTime] 
  );

  useEffect(() => {
    if (activeChain && activeChain.id !== chain.localhost.id) {
      switchNetwork();
    }
  }, [activeChain, switchNetwork]);

  const isOwner = () => {
    let ownerAddr = ownerAddress;
    if (account && ownerAddr) {
      return (ownerAddr === account.address);
    }
    return false;
  };

  return (
    <div className="App">
      <header className="App-header">
        { account ? 
        (
          <div> 
            <button className='Button' onClick={disconnect}>Disconnect</button>
            <div> 我的錢包地址: {account.address}</div>
            <hr />
            <h2> NFT Content：</h2>
            { totalSupply && <div> 已鑄造： { totalSupply.toNumber() } </div> }
            { accountBalance && <div> 擁有數量：{ accountBalance.toNumber() } </div> }
            <div>是否在白名單： {checkIsInWhitelist?"Yes":"No"}</div> 
            <h2> Sale Content：</h2>
            <div> 銷售金額： {price.toString()} ETH</div>
            { maxMintCount && <div> 總發行量：{ maxMintCount.toNumber() }</div> }
            { mintableCount && <div> 剩餘可售：{ mintableCount.toNumber() }</div> }
            <div> 銷售倒數： {(sellTimer < 0 ? "已開賣" : sellTimer)} </div>
            <div>&nbsp;</div>
            { !isMintLoading && activeChain && 
              <button className='Button' onClick={startMintNFT} disabled={!isAddressMintable()}>Mint</button> 
            }
            { !isAddressMintable() && <div className="Message">不在白名單無法鑄造！</div>}
            <hr />
            {
              isOwner() && 
                (<div>
                    <h2>Only for contract owner：</h2>
                    <div><button className='Button' onClick={setStartSellTime} >重置開賣時間</button></div>
                    {<input className='Input' type="text" value={addAddress} onChange={(event) => setWhitelistAddress(event.target.value)} placeholder="Input a wallet address" />}
                    { activeChain && <button className='Button' onClick={addAddressToWhitelistButtonClick}>Add to whitelist</button> }
                </div>)
            }
            
          </div>
        ) :     
        (
          <div> 
            {connectors.map((connector) => (
              <button className='Button' disabled={!connector.ready} key={connector.id} onClick={() => connect(connector)}>
                Connect Wallet
                {!connector.ready && " (不支援)"}
                {isConnecting && connector.id === pendingConnector?.id && " (連結中)"}
              </button>
            ))}
          </div>
        )
        }
      </header>
    </div>
  );
}

export default App;
