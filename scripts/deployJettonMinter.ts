import { compile, NetworkProvider } from "@ton/blueprint";
import { JettonMinter } from "../wrappers/JettonMinter";
import { Address, beginCell, toNano } from "@ton/core";
import { toNamespacedPath } from "path";

const JETTON_ADMIN_ADDRESS = Address.parse("")
const JETTON_METADATA_URI = ""
const JETTONS_TO_MINT: number = 100000000000

export async function run(provider: NetworkProvider) {
    const jettonMinter = provider.open(
        JettonMinter.createFromConfig({
            admin_address: JETTON_ADMIN_ADDRESS,
            content: beginCell().storeUint(1, 8).storeStringTail(JETTON_METADATA_URI).endCell(),
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
        jettonAmount: BigInt(JETTONS_TO_MINT) * BigInt(10 ** 9),
        fwdTonAmount: 1n,
        totalTonAmount: toNano("0.05")
    })
}