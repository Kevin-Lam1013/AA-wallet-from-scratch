import { prisma } from "@/utils/db";
import { isAddress } from "ethers/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Extract the search parametes from the request URL
    const { searchParams } = new URL(req.url);

    // Get the address from the search parameters
    const walletAddress = searchParams.get("walletAddress");

    // If the address is not provided, throw an error
    if (!walletAddress) {
      throw new Error("Missing or invalid address");
    }

    // If the address is not a valid Ethereum address, throw an error
    if (!isAddress(walletAddress)) {
      throw new Error("Invalid Ethereum address");
    }

    /**
     * Use Prisma to find all wallets where the given address is a signer
     * Also include a count of transactions for each wallet
     */
    const wallet = await prisma.wallet.findFirst({
      where: {
        address: walletAddress,
      },
    });

    // Return the wallets as a JSON response
    return NextResponse.json(wallet);
  } catch (error) {
    // Log any errors to the console and return them as a JSON response
    console.error(error);
    return NextResponse.json({ error });
  }
}
