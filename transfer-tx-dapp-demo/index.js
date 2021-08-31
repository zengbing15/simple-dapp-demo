const { RPC } = require("@ckb-lumos/rpc");
const {common} = require('@ckb-lumos/common-scripts');
const {Indexer} = require("@ckb-lumos/indexer");
const { initializeConfig, getConfig } = require("@ckb-lumos/config-manager");
const { key } = require("@ckb-lumos/hd");
const {TransactionSkeleton,sealTransaction} = require("@ckb-lumos/helpers");
const {Reader} = require("ckb-js-toolkit");
const {ALICE,BOB} = require("./accounts");

// set up config manager
process.env.LUMOS_CONFIG_FILE = process.env.LUMOS_CONFIG_FILE || './config.json'
initializeConfig();
const CKB_CONFIG = getConfig();

// set up lumos indexer
const CKB_RPC_URI = process.env.CKB_RPC_URI || "http://localhost:8114";
const CKB_INDEXER_DATA = process.env.CKB_INDEXER_DATA || "./indexer-data";
const indexer = new Indexer(CKB_RPC_URI, CKB_INDEXER_DATA);
indexer.startForever();

const rpc = new RPC(CKB_RPC_URI);
const FEE_RATE = BigInt(process.env.FEE_RATE || 1000);
const SHANNONS = BigInt(100000000);
const AMOUNT = BigInt(process.env.AMOUNT || 500)*SHANNONS;

async function main(){

    // create the txSkeleton
    const fromInfos = [
        ALICE.ADDRESS,
        {
        R: 0,
        M: 1,
        publicKeyHashes: [ALICE.ARGS],
    },
    ]

    let txSkeleton = TransactionSkeleton({ cellProvider: indexer });

    const tipheader = await rpc.get_tip_header();
    
    txSkeleton = await common.transfer(
        txSkeleton,
        fromInfos,
        BOB.ADDRESS,
        BigInt(AMOUNT),
        undefined,
        tipheader
    );

    // use `payFeeByFeeRate` to set dynamic tx fee
    txSkeleton = await common.payFeeByFeeRate(
        txSkeleton,
        fromInfos,
        FEE_RATE,
        tipheader
    );

    // prepare `signingEntries` and generate signing message
    txSkeleton = common.prepareSigningEntries(txSkeleton);
    const message = txSkeleton
    .get("signingEntries")
    .map((e) => {
    const lock = txSkeleton.get("inputs").get(e.index).cell_output.lock;
    return `${e.message}`
    }).toArray().toString(); 
    const hexmessage = new Reader(message).serializeJson();

    // sign and seal transaction
    const signature = key.signRecoverable(hexmessage, ALICE.PRIVATE_KEY);
    const tx = sealTransaction(txSkeleton, [signature]);
    console.log(JSON.stringify(tx,null,2))

    //send tx to CKB network
    const hash = await rpc.send_transaction(tx);
    console.log('The transaction hash is:', hash);
}

main();