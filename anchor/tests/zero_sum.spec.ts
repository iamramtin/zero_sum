import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { Keypair } from '@solana/web3.js'
import { ZeroSum } from '../target/types/zero_sum'

describe('zero_sum', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const payer = provider.wallet as anchor.Wallet

  const program = anchor.workspace.ZeroSum as Program<ZeroSum>

  const zero_sumKeypair = Keypair.generate()

  it('Initialize ZeroSum', async () => {
    await program.methods
      .initialize()
      .accounts({
        zero_sum: zero_sumKeypair.publicKey,
        payer: payer.publicKey,
      })
      .signers([zero_sumKeypair])
      .rpc()

    const currentCount = await program.account.zero_sum.fetch(zero_sumKeypair.publicKey)

    expect(currentCount.count).toEqual(0)
  })

  it('Increment ZeroSum', async () => {
    await program.methods.increment().accounts({ zero_sum: zero_sumKeypair.publicKey }).rpc()

    const currentCount = await program.account.zero_sum.fetch(zero_sumKeypair.publicKey)

    expect(currentCount.count).toEqual(1)
  })

  it('Increment ZeroSum Again', async () => {
    await program.methods.increment().accounts({ zero_sum: zero_sumKeypair.publicKey }).rpc()

    const currentCount = await program.account.zero_sum.fetch(zero_sumKeypair.publicKey)

    expect(currentCount.count).toEqual(2)
  })

  it('Decrement ZeroSum', async () => {
    await program.methods.decrement().accounts({ zero_sum: zero_sumKeypair.publicKey }).rpc()

    const currentCount = await program.account.zero_sum.fetch(zero_sumKeypair.publicKey)

    expect(currentCount.count).toEqual(1)
  })

  it('Set zero_sum value', async () => {
    await program.methods.set(42).accounts({ zero_sum: zero_sumKeypair.publicKey }).rpc()

    const currentCount = await program.account.zero_sum.fetch(zero_sumKeypair.publicKey)

    expect(currentCount.count).toEqual(42)
  })

  it('Set close the zero_sum account', async () => {
    await program.methods
      .close()
      .accounts({
        payer: payer.publicKey,
        zero_sum: zero_sumKeypair.publicKey,
      })
      .rpc()

    // The account should no longer exist, returning null.
    const userAccount = await program.account.zero_sum.fetchNullable(zero_sumKeypair.publicKey)
    expect(userAccount).toBeNull()
  })
})
