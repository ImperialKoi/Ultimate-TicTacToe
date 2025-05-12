import { NextResponse } from "next/server"
import { gameRooms } from "@/lib/game-server-store"

export async function POST(request: Request) {
  const data = await request.json()
  const { playerId } = data

  if (!playerId) {
    return NextResponse.json({ error: "Player ID is required" }, { status: 400 })
  }

  // Generate a random room ID
  const roomId = Math.random().toString(36).substring(2, 8).toUpperCase()

  // Create a new room
  gameRooms[roomId] = {
    id: roomId,
    players: [playerId],
    spectators: [],
    currentPlayer: "X",
    boards: Array(9)
      .fill(null)
      .map(() => Array(9).fill(null)),
    mainBoard: Array(9).fill(null),
    nextBoardIndex: -1,
    gameOver: false,
    winner: null,
    lastMove: null,
    lastUpdateTime: Date.now(),
  }

  return NextResponse.json({
    success: true,
    roomId,
    playerSymbol: "X",
    isHost: true,
    room: gameRooms[roomId],
  })
}
