import { TransactionWithSignatures } from "@/app/api/fetch-transactions/route";
import { BUNDLER_RPC_URL } from "@/utils/constants";
import { getUserOperationBuilder } from "@/utils/getUserOperationBuilder";
import getUserOpHash from "@/utils/getUserOpHash";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { Client, IUserOperation } from "userop";
import { useWalletClient } from "wagmi";
import Button from "./button";
import Icon from "./icon";
import { useIsMounted } from "@/hooks/useIsMounted";

interface TransactionListProps {
  address: string;
  walletAddress: string;
}

export default function TransactionsList({
  address,
  walletAddress,
}: TransactionListProps) {
  const isMounted = useIsMounted();
  const { data: walletClient } = useWalletClient();

  const [walletTxns, setWalletTxns] = useState<TransactionWithSignatures[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTransactions = async () => {
    try {
      const response = await fetch(
        `/api/fetch-transactions?walletAddress=${walletAddress}`
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setWalletTxns(data.transactions);
    } catch (error) {
      if (error instanceof Error) window.alert(error.message);
      console.error(error);
    }
  };

  const signTransaction = async (transaction: TransactionWithSignatures) => {
    // If there's no wallet client, return immediately
    if (!walletClient) return;

    try {
      setLoading(true);

      // Get the user operation hash from the transaction
      const userOpHash = await getUserOpHash(
        transaction.userOp as unknown as IUserOperation
      );

      // Request the wallet client to sign the messagewith the user operation hash
      const signature = await walletClient.signMessage({
        message: { raw: userOpHash as `0x${string}` },
      });

      // Send a POST request to the create-signature endpoint with the signer's address, signature and transaction ID
      const response = await fetch("/api/create-signature", {
        method: "POST",
        body: JSON.stringify({
          signerAddress: address,
          signature,
          transactionId: transaction.id,
        }),
      });

      // Parse the response data
      const data = await response.json();

      // If there's an error in the response data, throw it
      if (data.error) throw new Error(data.error);

      // Alert the user that the transaction was signed successfully
      window.alert("Transaction signed successfully");
      window.location.reload();
    } catch (e) {
      console.error(e);

      // If the error is an instance of Error, alert the user with the error message
      if (e instanceof Error) window.alert(e.message);
      setLoading(false);
    }
  };

  const sendTransaction = async (transaction: TransactionWithSignatures) => {
    try {
      setLoading(true);

      // Get the user operation from the transaction
      const userOp = transaction.userOp as unknown as IUserOperation;

      // Initialize the bundler's client
      const client = await Client.init(BUNDLER_RPC_URL);

      // Create an array to store the ordered signatures
      const orderedSignatures: string[] = [];

      // Order the signatures based on the order of the signers
      transaction.wallet.signers.forEach((signer) => {
        transaction.signatures.forEach((signature) => {
          if (signature.signerAddress === signer) {
            orderedSignatures.push(signature.signature);
          }
        });
      });

      if (orderedSignatures.length != transaction.wallet.signers.length)
        throw new Error("Fewer signatures received than expected");

      // Get the initCode frmo the user operation
      let initCode = userOp.initCode as Uint8Array;

      // If the wallet is already deployed, set the initCode to an empty array
      if (transaction.wallet.isDeployed) {
        initCode = Uint8Array.from([]);
      }

      const builder = await getUserOperationBuilder(
        userOp.sender,
        BigNumber.from(userOp.nonce),
        initCode,
        userOp.callData.toString(),
        orderedSignatures
      );

      // Set the maxFeePerGas and maxPriorityFeePerGas in the builder
      builder
        .setMaxFeePerGas(userOp.maxFeePerGas)
        .setMaxPriorityFeePerGas(userOp.maxPriorityFeePerGas);

      // Send the user operation and wait for the result
      const result = await client.sendUserOperation(builder);
      const finalUserOpResult = await result.wait();

      // Get the transaction receipt
      const txHashReciept = await finalUserOpResult?.getTransactionReceipt();

      const txHash = txHashReciept?.transactionHash;

      // mark the wallet as deployed by sending a POST request to the update-wallet-deployed endpoint
      await fetch("/api/update-wallet-deployed", {
        method: "POST",
        body: JSON.stringify({
          walletId: transaction.wallet.id,
          transactionId: transaction.id,
          txHash,
        }),
      });

      window.alert("Transaction sent successfully");
      window.location.reload();
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        window.alert(e.message);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  if (!isMounted) return null;

  return (
    <main className="flex flex-col justify-center p-10 items-center  gap-5">
      <h1 className="text-5xl font-bold">Transactions</h1>

      {walletTxns.length === 0 && (
        <div className="flex justify-center items-center border-2 border-dashed p-6 rounded-lg">
          <p className="text-lg">You currently have no transactions.</p>
        </div>
      )}

      {walletTxns.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {walletTxns.map((transaction) => (
            <div
              key={transaction.id}
              className="flex flex-col border border-gray-800 rounded-lg gap-2 p-2">
              <span className="bg-gray-800 w-full text-center">
                Transaction #{transaction.id}
              </span>
              <div className="flex flex-col gap-2">
                {transaction.signatures.map((signature) => (
                  <div
                    key={signature.signature}
                    className="flex font-mono gap-4">
                    <span>{signature.signerAddress}</span>
                    <Icon type="check" />
                  </div>
                ))}
                {transaction.pendingSigners.map((signer) => (
                  <div key={signer} className="flex font-mono gap-4">
                    <span>{signer}</span>
                    <Icon type="xmark" />
                  </div>
                ))}

                {transaction.txHash ? (
                  <Button
                    onClick={() =>
                      window.open(
                        `https://goerli.etherscan.io/tx/${transaction.txHash}`,
                        "_blank"
                      )
                    }>
                    View on Etherscan
                  </Button>
                ) : transaction.pendingSigners.length === 0 ? (
                  <Button
                    onClick={() => sendTransaction(transaction)}
                    isLoading={loading}>
                    Execute Txn
                  </Button>
                ) : transaction.pendingSigners.includes(
                    address.toLowerCase()
                  ) ? (
                  <Button
                    onClick={() => signTransaction(transaction)}
                    isLoading={loading}>
                    Sign Txn
                  </Button>
                ) : (
                  <Button disabled>No Action Reqd</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
