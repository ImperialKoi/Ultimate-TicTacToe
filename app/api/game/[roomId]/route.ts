import { NextResponse } from "next/server"
import { gameRooms } from "@/lib/game-server-store"

// GET endpoint to retrieve game state
export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId

  if (!gameRooms[roomId]) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 })
  }

  return NextResponse.json(gameRooms[roomId])
}

// POST endpoint to update game state
export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId
  const data = await request.json()

  if (!gameRooms[roomId]) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 })
  }

  // Handle different action types
  switch (data.action) {
    case "join":
      return handleJoinRoom(roomId, data.playerId)

    case "move":
      return handleMakeMove(roomId, data.playerId, data.boardIndex, data.cellIndex)

    case "reset":
      return handleResetGame(roomId, data.playerId)

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }
}

// Handle a player joining a room
function handleJoinRoom(roomId: string, playerId: string) {
  const room = gameRooms[roomId]

  // Check if player is already in the room
  if (room.players.includes(playerId)) {
    return NextResponse.json({
      success: true,
      playerSymbol: room.players.indexOf(playerId) === 0 ? "X" : "O",
      isHost: room.players.indexOf(playerId) === 0,
      room,
    })
  }

  // Check if room is full
  if (room.players.length >= 2) {
    // Add as spectator
    if (!room.spectators.includes(playerId)) {
      room.spectators.push(playerId)
    }

    return NextResponse.json({
      success: true,
      playerSymbol: "spectator",
      isHost: false,
      room,
    })
  }

  // Add player to room
  room.players.push(playerId)
  room.lastUpdateTime = Date.now()

  return NextResponse.json({
    success: true,
    playerSymbol: "O",
    isHost: false,
    room,
  })
}

// Handle a player making a move
function handleMakeMove(roomId: string, playerId: string, boardIndex: number, cellIndex: number) {
  const room = gameRooms[roomId]

  // Check if it's the player's turn
  const playerIndex = room.players.indexOf(playerId)
  if (
    playerIndex === -1 ||
    (playerIndex === 0 && room.currentPlayer !== "X") ||
    (playerIndex === 1 && room.currentPlayer !== "O")
  ) {
    return NextResponse.json({ error: "Not your turn" }, { status: 400 })
  }

  // Check if the move is valid
  if (room.gameOver) {
    return NextResponse.json({ error: "Game is over" }, { status: 400 })
  }

  if (
    room.nextBoardIndex !== -1 &&
    room.nextBoardIndex !== boardIndex &&
    room.mainBoard[room.nextBoardIndex] === null
  ) {
    return NextResponse.json({ error: "Invalid board" }, { status: 400 })
  }

  if (room.mainBoard[boardIndex] !== null) {
    return NextResponse.json({ error: "Board already won" }, { status: 400 })
  }

  if (room.boards[boardIndex][cellIndex] !== null) {
    return NextResponse.json({ error: "Cell already filled" }, { status: 400 })
  }

  // Make the move
  room.boards[boardIndex][cellIndex] = room.currentPlayer
  room.lastMove = { boardIndex, cellIndex }

  // Check if this move won the small board
  const boardWinner = checkBoardWinner(room.boards[boardIndex])
  if (boardWinner) {
    room.mainBoard[boardIndex] = boardWinner

    // Check if this won the game
    const gameWinner = checkBoardWinner(room.mainBoard)
    if (gameWinner) {
      room.winner = gameWinner
      room.gameOver = true
    }
  }

  // Set the next board to play in
  room.nextBoardIndex = room.mainBoard[cellIndex] === null ? cellIndex : -1

  // Switch player
  room.currentPlayer = room.currentPlayer === "X" ? "O" : "X"

  // Check for draw
  if (!room.gameOver && room.mainBoard.every((cell) => cell !== null)) {
    room.gameOver = true
    room.winner = "draw"
  }

  room.lastUpdateTime = Date.now()

  return NextResponse.json({ success: true, room })
}

// Handle resetting the game
function handleResetGame(roomId: string, playerId: string) {
  const room = gameRooms[roomId]

  // Only host can reset the game
  if (room.players[0] !== playerId) {
    return NextResponse.json({ error: "Only host can reset the game" }, { status: 400 })
  }

  // Reset the game
  room.boards = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null))
  room.mainBoard = Array(9).fill(null)
  room.currentPlayer = "X"
  room.nextBoardIndex = -1
  room.gameOver = false
  room.winner = null
  room.lastMove = null
  room.lastUpdateTime = Date.now()

  return NextResponse.json({ success: true, room })
}

// Check if a board has a winner
function checkBoardWinner(board: any[]): "X" | "O" | "draw" | null {
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // columns
    [0, 4, 8],
    [2, 4, 6], // diagonals
  ]

  for (const [a, b, c] of winningCombinations) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }

  // Check for draw
  if (board.every((cell) => cell !== null)) {
    return "draw"
  }

  return null
}
