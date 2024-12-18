import { compile, NetworkProvider } from "@ton/blueprint";
import { JettonWallet } from "../wrappers/JettonWallet";
import { Address, toNano } from "@ton/core";
import { JettonMinter } from "../wrappers/JettonMinter";

const JETTON_MASTER_ADDRESS = Address.parse("kQD3t1nXbUNPZcjx6z4q98NMMfPcDICjcWClWYmSaV1ANIYX")

export async function run(provider: NetworkProvider) {
    const jettonMinter = provider.open(
        JettonMinter.createFromAddress(JETTON_MASTER_ADDRESS)
    )
    const jettonWallet = provider.open(
        JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(provider.sender().address!))
    )

    const isDeployed = await provider.isContractDeployed(jettonWallet.address)
    if (!isDeployed) {
        await jettonWallet.sendDeploy(provider.sender(), toNano("0.05"))
        await provider.waitForDeploy(jettonWallet.address)  
    }

    
}