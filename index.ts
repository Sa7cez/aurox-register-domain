import axios from 'axios'
import { ethers } from 'ethers'
import { Wallet } from '@ethersproject/wallet'
import { promises as fs } from 'fs'
import * as path from 'path'
import delay from "delay"
import { generateMnemonic } from "bip39"
import randomWords from "random-words"

// Yout can setup bot here:
const TIMEOUT = 50
const NUMBER_MODE = true
const DOMAINS_LIMIT = 123
const WORD_LENGTH = 3

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
  
  while(!subdomain && domains.length > 0) {
    let domain = domains[randomInt(domains.length)]
    subdomain = (await aurox.get(`check/${domain}`)).data.resolveAddress === '0x0000000000000000000000000000000000000000'
      ? domain : null
    if (!subdomain)
      domains.splice(domains.indexOf(domain, 0), 1)
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
  }).then(async (r) => {
    await fs.appendFile('results.csv', `"${subdomain}";"${signer.address}";"${signer.privateKey}"\n`)
    return r.data.result
  }).catch(e => {
    if (e.response.data.error.indexOf('must contain a valid domain name') > -1)
      return registerNewWallet(key)
    return 'Registration failed'
  })
}

let domains = []
const main = async () => {
  try {
    // Domains, if not exists activate randomizer
    try {
      domains = (await fs.readFile('domains.txt', 'utf8')).split('\n').filter(item => item.length > 0 && item.length < 10)
      domains = [...new Set(domains)] // delete dublicates
      await fs.writeFile('domains.txt', domains.join('\n'))
    } catch (e) {
      domains = NUMBER_MODE
        ? Array.from(Array(DOMAINS_LIMIT), (_,x) => x) // Number domains
        : Array.from(Array(DOMAINS_LIMIT), (_,x) => randomWords({exactly: 1, maxLength: WORD_LENGTH})) // Word domains
    }

    // Keys, if not exists activate generation
    let keys = []
    try {
      keys = (await fs.readFile('keys.txt', 'utf8')).split('\n').filter(item => item.length >= 64)
    } catch (e) {
      console.log(`Start generate ${domains.length} new wallets, it's may be slowly...`)
      for (let i = 0; i < domains.length * 2; i++) {
        const mnemonic = generateMnemonic()
        const wallet = Wallet.fromMnemonic(mnemonic)
        keys.push(wallet.privateKey)
        await fs.appendFile('wallets.csv', `"${wallet.address}";"${wallet.privateKey}";"${mnemonic}"\n`)
      }
    }

    if (keys.length === 0) {
      console.log('Fill file keys.txt')
      return 
    }
    console.log(`You set ${domains.length} domains for ${keys.length} addresses!`)
    for(const key of keys) {
      console.log(await registerNewWallet(key), '\n')
      await delay(TIMEOUT + randomInt(TIMEOUT))
      if (domains.length === 0) {
        console.log('Not enough domains :(')
        return
      }
    }
  } catch (e) {
    console.log(e)
    console.log('Create files keys.txt and domains.txt!')
  }
}

main()