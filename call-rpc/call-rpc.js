const { RPC } = require('ckb-js-toolkit');
const rpc = new RPC("http://localhost:8114");
async function main(){
    const result = await rpc.get_blockchain_info();
    console.log(result);
}
main();
