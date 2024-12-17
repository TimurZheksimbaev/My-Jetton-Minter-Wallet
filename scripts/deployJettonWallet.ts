import { compile, NetworkProvider } from "@ton/blueprint";
import { JettonWallet } from "../wrappers/JettonWallet";
import { Address } from "@ton/core";

const JETTON_WALLET_OWNER_ADDRESS = Address.parse("")
const JETTON_MASTER_ADDRESS = Address.parse("EQCgIfBtyd7MNPfWw-UwWNGxnuaBqWqy_Mc8Yg0OiJuk_xft")

export async function run(provider: NetworkProvider) {
    const jettonWallet = await provider.open(
        JettonWallet.createFromConfig({
            balance: 0,
            ownerAddress: JETTON_WALLET_OWNER_ADDRESS,
            jettonMasterAddress: JETTON_MASTER_ADDRESS,
            jettonWalletCode: await compile("JettonWallet")
        }, await compile("JettonWallet"))
    )
}