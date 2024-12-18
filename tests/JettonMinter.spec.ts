import { Address, Cell, toNano } from "@ton/core"
import { compile, createNetworkProvider, NetworkProvider } from "@ton/blueprint"
import { jettonContentToCell, JettonMinter } from "../wrappers/JettonMinter"
import { JettonWallet } from "../wrappers/JettonWallet"
import {Blockchain, SandboxContract, TreasuryContract} from "@ton/sandbox";
import '@ton/test-utils';

const JETTON_ADMIN_ADDRESS = Address.parse("0QDaNVh0t5Ek3Haj0yOdwryUq4gSBWFVkRKPCiYlRgN5exlj")
const JETTON_MASTER_ADDRESS = Address.parse("kQD3t1nXbUNPZcjx6z4q98NMMfPcDICjcWClWYmSaV1ANIYX")
const JETTON_METADATA_URI = "https://raw.githubusercontent.com/TimurZheksimbaev/My-Jetton-Minter-Wallet/refs/heads/main/jettonMetadata.json"


describe("JettonMinter tests", () => {
    // Blockchain
    let blockchain: Blockchain
    let deployer: SandboxContract<TreasuryContract>

    // Contracts
    let jettonMinter: SandboxContract<JettonMinter>
    let jettonWallet: any

    // Code
    let jettonMinterCode: Cell
    let jettonWalletCode: Cell

    // Wallets
    let admin: SandboxContract<TreasuryContract>
    let user: SandboxContract<TreasuryContract>
    let otherUser: SandboxContract<TreasuryContract>

    beforeAll(async () => {

        blockchain = await Blockchain.create()
        deployer = await blockchain.treasury("deployer")
        
        admin = await blockchain.treasury("admin")
        user = await blockchain.treasury("user")
        otherUser = await blockchain.treasury("otherUser")

        // Code
        jettonMinterCode = await compile("JettonMinter")
        jettonWalletCode = await compile("JettonWallet")

        // Contracts
        jettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin_address: admin.address,
                    content: jettonContentToCell(JETTON_METADATA_URI),
                    jetton_wallet_code: jettonWalletCode
                },
                jettonMinterCode
            )
        )

        jettonWallet = async (address: Address) => blockchain.openContract(
            JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(address))
        )

    })

    it("should deploy jetton minter", async () => {
        const deployResult = await jettonMinter.sendDeploy(
            admin.getSender(),
            toNano("0.05")
        )

        expect(deployResult.transactions).toHaveTransaction(
            {
                from: admin.address,
                to: jettonMinter.address,
                deploy: true,
                success: true
            }
        )
    })

    it("only admin can mint tokens", async () => {
        const mintResult = await jettonMinter.sendMintTokens(
            deployer.getSender(),
            {
                toAddress: admin.address,
                jettonAmount: toNano("10000000"),
                fwdTonAmount: toNano("0.05"),
                totalTonAmount: toNano("1")
            }
        )

        expect(mintResult.transactions).toHaveTransaction(
            {
                success: false,
                exitCode: 73 // exit code if sender address != admin address
            }
        )
    })
    
    it("should mint tokens on admin address", async () => {
        const adminJettonWallet = await jettonWallet(admin.address)
        const mintResult = await jettonMinter.sendMintTokens(
            admin.getSender(),
            {
                toAddress: admin.address,
                jettonAmount: toNano("10000000"),
                fwdTonAmount: toNano("0.05"),
                totalTonAmount: toNano("1")
            }
        )

        expect(mintResult.transactions).toHaveTransaction(
            {
                from: jettonMinter.address,
                to: adminJettonWallet.address,
                deploy: true
            }
        )

        expect( mintResult.transactions).toHaveTransaction({ // excesses
            from: adminJettonWallet.address,
            to: jettonMinter.address
        });


        const jettonBalance = (await jettonMinter.getJettonData()).totalSupply

        expect(jettonBalance).toEqual(toNano("10000000"))

    })

    it("should mint tokens on other address", async () => {
        const userJettonWallet = await jettonWallet(user.address)
        const mintResult = await jettonMinter.sendMintTokens(
            admin.getSender(),
            {
                toAddress: user.address,
                jettonAmount: toNano("10000000"),
                fwdTonAmount: toNano("0.05"),
                totalTonAmount: toNano("1")
            }
        )

        expect(mintResult.transactions).toHaveTransaction(
            {
                from: jettonMinter.address,
                to: userJettonWallet.address,
                deploy: true
            }
        )

        expect( mintResult.transactions).toHaveTransaction({ // excesses
            from: userJettonWallet.address,
            to: jettonMinter.address
        });


        const jettonBalance = (await jettonMinter.getJettonData()).totalSupply

        expect(jettonBalance).toEqual(toNano("20000000")) // 2 because i already minted tokens to admin
    })

    it("send tokens from user to other user", async () => {
        jettonMinter.sendMintTokens(admin.getSender(), {
            toAddress: admin.address,
            jettonAmount: toNano("50"),
            fwdTonAmount: toNano("0.05"),
            totalTonAmount: toNano("0.05")
        })

        jettonMinter.sendMintTokens(admin.getSender(), {
            toAddress: deployer.address,
            jettonAmount: toNano("50"),
            fwdTonAmount: toNano("0.05"),
            totalTonAmount: toNano("0.05")
        })

        const adminWallet = await jettonWallet(admin.address)
        const deployerWallet = await jettonWallet(deployer.address)

        const adminWalletBalance = adminWallet.getWalletData().balance
        const deployerWalletBalance = deployerWallet.getWalletData().balance
        const initialTotalSupply = (await jettonMinter.getJettonData()).totalSupply

        const forwardAmount = toNano("0.05")
        const jettonAmount = toNano("25")

        const sendResult = await adminWallet.sendTransferTokens(
            admin.getSender(),
            toNano("0.05"),
            {
                amount: jettonAmount,
                destination_address: deployer.address,
                response_address: admin.address,
                custom_payload: null,
                fwd_amount: forwardAmount,
                fwd_payload: null
            }
        )

        expect(sendResult.transactions).toHaveTransaction(
            {
                from: deployerWallet.address,
                to: admin.address
            }
        )

        expect(sendResult.transactions).toHaveTransaction(
            {
                from: deployerWallet.address,
                to: deployerWallet.address,
                value: forwardAmount
            }
        )

        expect((await adminWallet.getWalletData()).balance).toEqual(adminWalletBalance - jettonAmount)
        expect((await deployerWallet.getWalletData()).balance).toEqual(deployerWalletBalance + jettonAmount)
        expect((await jettonMinter.getJettonData()).totalSupply).toEqual(initialTotalSupply)
    })

})

