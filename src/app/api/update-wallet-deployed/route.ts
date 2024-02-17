import { prisma } from "@/utils/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Destructure walletId, transactionId, and txHash frmot he request
    const { walletId, transactionId, txHash } = await req.json();

    // Update the wallet's isDeployed status to true
    await prisma.wallet.update({
      where: {
        id: walletId,
      },
      data: {
        isDeployed: true,
      },
    });

    // Update the transaction with the txHash
    const res = await prisma.transaction.update({
      where: {
        id: transactionId,
      },
      data: {
        txHash,
      },
    });

    // Return the updated transaction
    return NextResponse.json(res);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error });
  }
}
