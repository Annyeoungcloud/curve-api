import axios from 'axios';
import Web3 from 'web3';
import BigNumber from 'big-number';
import WEB3_CONSTANTS from 'constants/Web3';
import { fn } from '../../utils/api';
import { getFeeDistributor } from '../../utils/getters';
import { getThursdayUTCTimestamp } from '../../utils/helpers';
import distributorAbi from '../../constants/abis/distributor.json';
import tripoolSwapAbi from '../../constants/abis/tripool_swap.json';

const web3 = new Web3(WEB3_CONSTANTS.RPC_URL);


export default fn(async () => {

  const GRAPH_ENDPOINT = "https://api.thegraph.com/subgraphs/name/convex-community/curve-factory-volume"
  const CURRENT_TIMESTAMP = Math.round(new Date().getTime() / 1000);
  const TIMESTAMP_24H_AGO = CURRENT_TIMESTAMP - (25 * 3600);
  const poolListData = await (await fetch(`https://api.curve.fi/api/getPoolList`)).json()
  let poolList = poolListData.data.poolList
  let totalVolume = 0

  for (var i = 0; i < poolList.length; i++) {


      let POOL_QUERY = `
      {
        hourlySwapVolumeSnapshots(
          first: 1000,
          orderBy: timestamp,
          orderDirection: desc,
          where: {
            pool: "${poolList[i].address.toLowerCase()}"
            timestamp_gt: ${TIMESTAMP_24H_AGO}
          }
        )
        {
          volume
          volumeUSD
          timestamp
          count
        }
      }
      `
      const res = await fetch(GRAPH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: POOL_QUERY })
      })

      const data = await res.json()
      let rollingDaySummedVolume = 0
      let rollingRawVolume = 0
      for (let i = 0; i < data.data.hourlySwapVolumeSnapshots.length; i ++) {
          const hourlyVolUSD = parseFloat(data.data.hourlySwapVolumeSnapshots[i].volumeUSD)
          rollingDaySummedVolume =  rollingDaySummedVolume + hourlyVolUSD

          const hourlyVol = parseFloat(data.data.hourlySwapVolumeSnapshots[i].volume)
          rollingRawVolume =  rollingRawVolume + hourlyVol
      }

      poolList[i].volumeUSD = rollingDaySummedVolume
      poolList[i].rawVolume = rollingRawVolume

      totalVolume += parseFloat(rollingDaySummedVolume)
  }

  return { poolList, totalVolume }
}, {
  maxAge: 5 * 60, // 15 min
});
