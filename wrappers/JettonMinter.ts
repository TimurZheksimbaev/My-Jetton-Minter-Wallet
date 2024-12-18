import {Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano} from "@ton/core"

const OP_CODE_MINT = 0x895f5f3e
const OP_CODE_BURN = 0x7bdd97de
const OP_CODE_INTERNAL_TRANSFER = 0x178d4519
const OP_CODE_CHANGE_ADMIN = 0x895d6f3e
const OP_CODE_CHANGE_CONTENT = 0x873e46a



export type JettonMinterConfig = {
    admin_address: Address,
    content: Cell,
    jetton_wallet_code: Cell
}

export function jettonMinterConfigToCell(config: JettonMinterConfig) {
    return beginCell()
            .storeCoins(0)
            .storeAddress(config.admin_address)
            .storeRef(config.content)
            .storeRef(config.jetton_wallet_code)
            .endCell()
}

export function jettonContentToCell(uri: string) {
    return beginCell()
            .storeUint(1, 8)
            .storeStringTail(uri)
            .endCell()
}



export class JettonMinter implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: {code: Cell; data: Cell}
    ) {}

    static createFromConfig(config: JettonMinterConfig, code: Cell, workchain=0) {
        const data = jettonMinterConfigToCell(config)
        const init = {code, data}
        return new JettonMinter(contractAddress(workchain, init), init)
    }

    static createFromAddress(address: Address) {
        return new JettonMinter(address)
    }

    protected static jettonInternalTransfer(jetton_amount: bigint,
        forward_ton_amount: bigint,
        response_addr?: Address,
        query_id: number | bigint = 0
    ) {

    return beginCell()
        .storeUint(OP_CODE_INTERNAL_TRANSFER, 32)
        .storeUint(query_id, 64)
        .storeCoins(jetton_amount)
        .storeAddress(null)
        .storeAddress(response_addr)
        .storeCoins(forward_ton_amount)
        .storeBit(false)
        .endCell();
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell()
        })
    }

    async mintMessage(from: Address, to: Address, jettonAmount: bigint, fwdTonAmount: bigint, totalTonAmount: bigint) {
        const mintMsg = beginCell()
                        .storeUint(OP_CODE_INTERNAL_TRANSFER, 32)
                        .storeUint(0, 64)
                        .storeCoins(jettonAmount)
                        .storeAddress(null)
                        .storeAddress(from)
                        .storeCoins(fwdTonAmount)
                        .storeMaybeRef(null)
                    .endCell()

        return beginCell()
                .storeUint(OP_CODE_MINT, 32)
                .storeUint(0, 64)
                .storeAddress(to)
                .storeCoins(totalTonAmount)
                .storeCoins(jettonAmount)
                .storeRef(mintMsg)
            .endCell()
    }

    async sendMintTokens(provider: ContractProvider, via: Sender, opts: {
        toAddress: Address,
        jettonAmount: bigint,
        fwdTonAmount: bigint,
        totalTonAmount: bigint
    }) { 
        await provider.internal(via, {
            value: toNano("0.015") + opts.totalTonAmount,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: await this.mintMessage(this.address, opts.toAddress, opts.jettonAmount, opts.fwdTonAmount, opts.totalTonAmount)
        })
    }

    async sendChangeAdmin(provider: ContractProvider, via: Sender, newAdmin: Address) {
        await provider.internal(via, {
            value: toNano("0.05"),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OP_CODE_CHANGE_ADMIN, 32)
                .storeUint(0, 64)
                .storeAddress(newAdmin)
                .endCell()
        })
    }

    async sendChangeContent(provider: ContractProvider, via: Sender, newContent: Cell) {
        await provider.internal(via, {
            value: toNano("0.05"),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OP_CODE_CHANGE_CONTENT, 32)
                .storeUint(0, 64)
                .storeRef(newContent)
                .endCell()
        })
    }

    async getWalletAddress(provider: ContractProvider, owner: Address) {
        const result = 
        (await provider.get("get_wallet_address", 
            [{
                type: "slice",
                cell: beginCell().storeAddress(owner).endCell()
            }]
        )).stack
        return result.readAddress()
    }

    async getJettonData(provider: ContractProvider) {
        const result = (await provider.get("get_jetton_data", [])).stack
        return {
            totalSupply: result.readBigNumber(),
            mintable: result.readBoolean(),
            adminAddress: result.readAddress(),
            content: result.readCell(),
            jettonWalletCode: result.readCell()
        }
    }
}