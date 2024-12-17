import { compile, NetworkProvider } from "@ton/blueprint";
import { JettonMinter, jettonContentToCell } from "../wrappers/JettonMinter";
import { Address, beginCell, toNano } from "@ton/core";
import { toNamespacedPath } from "path";

const JETTON_ADMIN_ADDRESS = Address.parse("0QDaNVh0t5Ek3Haj0yOdwryUq4gSBWFVkRKPCiYlRgN5exlj")
const JETTON_METADATA_URI = "https://raw.githubusercontent.com/TimurZheksimbaev/My-Jetton-Minter-Wallet/refs/heads/main/jettonMetadata.json"
const JETTONS_TO_MINT: number = 100000000000

export async function run(provider: NetworkProvider) {
    const jettonMinter = provider.open(
        JettonMinter.createFromConfig({
            admin_address: JETTON_ADMIN_ADDRESS,
            content: jettonContentToCell(JETTON_METADATA_URI),
            jetton_wallet_code: await compile('JettonWallet')
        }, await compile('JettonMinter'))
    )

    const isDeployed = await provider.isContractDeployed(jettonMinter.address)

    if (!isDeployed) {
        await jettonMinter.sendDeploy(provider.sender(), toNano("0.05"))
        await provider.waitForDeploy(jettonMinter.address)
    }

    await jettonMinter.sendMintTokens(provider.sender(), {
        toAddress: provider.sender().address!,
        jettonAmount: toNano("10000000"), 
        fwdTonAmount: 1n,
        totalTonAmount: toNano("0.05")
    })
}