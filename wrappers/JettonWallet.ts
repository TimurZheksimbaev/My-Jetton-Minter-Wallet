import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from "@ton/core";

const OP_CODE_TRANSFER = 0xf8a7ea5
const OP_CODE_RECEIVE = 0x178d4519
const OP_CODE_BURN = 0x595f07bc

export type JettonWalletConfig = {
    balance: number;
    ownerAddress: Address;
    jettonMasterAddress: Address,
    jettonWalletCode: Cell
}

export function jettonWalletConfigToCell(config: JettonWalletConfig) {
    return beginCell()
            .storeCoins(config.balance)
            .storeAddress(config.ownerAddress)
            .storeAddress(config.jettonMasterAddress)
            .storeRef(config.jettonWalletCode)
            .endCell()
}

export class JettonWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: {code: Cell, data: Cell}
    ){}

    static createFromAddress(address: Address) {
        return new JettonWallet(address)
    }

    static createFromConfig(config: JettonWalletConfig, code: Cell, workchain = 0) {
        const data = jettonWalletConfigToCell(config)
        const init = {code, data}
        return new JettonWallet(contractAddress(workchain, init), init)
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell()
        })
    }

    async sendTransferTokens(provider: ContractProvider, via: Sender, value: bigint, opts: {
        amount: bigint,
        destination_address: Address,
        response_address: Address,
        custom_payload: Cell,
        fwd_amount: bigint,
        fwd_payload: Cell
    }) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OP_CODE_TRANSFER, 32)
                .storeUint(0, 64)
                .storeCoins(opts.amount)
                .storeAddress(opts.destination_address)
                .storeAddress(opts.response_address)
                .storeRef(opts.custom_payload)
                .storeCoins(opts.fwd_amount)
                .storeRef(opts.fwd_payload)
                .endCell()
        })
    }

    async receiveTokens(provider: ContractProvider, via: Sender, value: bigint, opts: {

    }) {}


    async getWalletData(provider: ContractProvider) {
        const result = (await provider.get("get_wallet_data", [])).stack
        return {
            balance: result.readBigNumber(),
            ownerAddress: result.readAddress(),
            jettonMasterAddress: result.readAddress(),
            jettonWalletCode: result.readCell()
        }
    }


}