import axios from 'axios'
import { ethers } from 'ethers'
import { Wallet } from '@ethersproject/wallet'
import { promises as fs } from 'fs'
import * as path from 'path'
import delay from "delay"

// Helpers
const randomInt = (value) => Math.floor(Math.random() * value)

// Instance
const aurox = axios.create({
  baseURL: 'https://ens.getaurox.com/api/v1/subdomains/',
  headers: {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US;q=0.9,en;q=0.8",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "none",
    "sec-gpc": "1"
  }
})

const registerNewWallet = async (key) => {
  const provider = ethers.getDefaultProvider('goerli')
  const signer = new Wallet(key, provider)
  console.log(`Let's check ${signer.address}...`)

  let subdomain = (await aurox.get(`checkAddress/${signer.address}`)).data.subdomain
  if (subdomain)
    return `Address already registered as ${subdomain}`
  
  while(!subdomain) {
    let domain = domains[randomInt(domains.length)]
    subdomain = (await aurox.get(`check/${domain}`)).data.resolveAddress === '0x0000000000000000000000000000000000000000'
      ? domain : null
  }
  console.log(`Choose random domain - ${subdomain}`)

  const data = { ethAddress: signer.address, requestedSubdomain: subdomain }
  const requestMethod = "POST"
  const requestPath = "/api/v2/subdomains/register"
  const message = `${requestMethod}${requestPath}${JSON.stringify(data)}`
  const signature = await signer.signMessage(message)
  aurox.defaults.headers['x-aurox-address'] = signer.address
  aurox.defaults.headers['x-aurox-signature'] = signature
  
  return await aurox.post('register', {
    ethAddress: signer.address,
    requestedSubdomain: subdomain
  }).then(r => {
    return r.data.result
  }).catch(e => {
    console.log(e)
    return 'Registration failed'
  })
}

let domains = []
const main = async () => {
  try {
    const keys = (await fs.readFile('keys.txt', 'utf8')).split('\n').filter(item => item.length >= 64)
    domains = (await fs.readFile('domains.txt', 'utf8')).split('\n').filter(item => item.length > 0 && item.length < 10)
    if (domains.length === 0) {
      console.log('Fill file domains.txt')
      return 
    }
    if (keys.length === 0) {
      console.log('Fill file keys.txt')
      return 
    }
    console.log(`You set ${domains.length} domains for ${keys.length} addresses!`)
    for(const key of keys) {
      console.log(await registerNewWallet(key), '\n')
      await delay(1000 + randomInt(2000))
    }
  } catch (e) {
    console.log(e)
    console.log('Create files keys.txt and domains.txt!')
  }
}

main()
