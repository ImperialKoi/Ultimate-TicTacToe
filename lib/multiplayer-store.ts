import { create } from "zustand"
import { v4 as uuidv4 } from "uuid"

type Player = "X" | "O" | null
type BoardState = Player[]
type UltimateBoardState = (Player | "draw")[]

// Winning combinations
const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // columns
  [0, 4, 8],
  [2, 4, 6], // diagonals
]

export type GameRoom = {
  id: string
  players: string[]
  currentPlayer: "X" | "O"
  boards: BoardState[]
  mainBoard: UltimateBoardState
  nextBoardIndex: number
  gameOver: boolean
  winner: "X" | "O" | "draw" | null
  lastMove: { boardIndex: number; cellIndex: number } | null
  lastUpdateTime: number
}

type MultiplayerStore = {
  // Player info
  playerId: string
  playerSymbol: "X" | "O" | "spectator" | null

  // Room info
  currentRoom: GameRoom | null
  isHost: boolean

  // Game actions
  createRoom: () => string
  joinRoom: (roomId: string) => { success: boolean; error?: string }
  leaveRoom: () => void
  makeMove: (boardIndex: number, cellIndex: number) => boolean
  resetGame: () => void

  // Mock server-side functionality (for demo)
  rooms: Record<string, GameRoom>
  pollGameState: (roomId: string) => GameRoom | null
}

// Check if a board has a winner
const checkBoardWinner = (board: BoardState): Player | "draw" => {
  for (const [a, b, c] of WINNING_COMBINATIONS) {
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

// Create the store
const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  // Player info
  playerId: typeof window !== "undefined" ? localStorage.getItem("ultimateTicTacToePlayerId") || uuidv4() : uuidv4(),
  playerSymbol: null,

  // Room info
  currentRoom: null,
  isHost: false,

  // Mock server-side storage
  rooms: {},

  // Create a new room
  createRoom: () => {
    const { playerId, rooms } = get()

    // Save player ID to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("ultimateTicTacToePlayerId", playerId)
    }

    // Create a new room
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase()

    const newRoom: GameRoom = {
      id: roomId,
      players: [playerId],
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

    // Update store
    set((state) => ({
      rooms: {
        ...state.rooms,
        [roomId]: newRoom,
      },
      currentRoom: newRoom,
      playerSymbol: "X",
      isHost: true,
    }))

    return roomId
  },

  // Join an existing room
  joinRoom: (roomId: string) => {
    const { playerId, rooms } = get()

    // Save player ID to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("ultimateTicTacToePlayerId", playerId)
    }

    // Check if room exists
    if (!rooms[roomId]) {
      return { success: false, error: "Room not found" }
    }

    const room = rooms[roomId]

    // Check if player is already in the room
    if (room.players.includes(playerId)) {
      set({
        currentRoom: room,
        playerSymbol: room.players.indexOf(playerId) === 0 ? "X" : "O",
        isHost: room.players.indexOf(playerId) === 0,
      })
      return { success: true }
    }

    // Check if room is full
    if (room.players.length >= 2) {
      set({
        currentRoom: room,
        playerSymbol: "spectator",
        isHost: false,
      })
      return { success: true }
    }

    // Join the room
    const updatedRoom = {
      ...room,
      players: [...room.players, playerId],
      lastUpdateTime: Date.now(),
    }

    // Update store
    set((state) => ({
      rooms: {
        ...state.rooms,
        [roomId]: updatedRoom,
      },
      currentRoom: updatedRoom,
      playerSymbol: "O",
      isHost: false,
    }))

    return { success: true }
  },

  // Leave the current room
  leaveRoom: () => {
    const { currentRoom, playerId } = get()

    if (!currentRoom) return

    const roomId = currentRoom.id

    // Remove player from room
    const playerIndex = currentRoom.players.indexOf(playerId)

    if (playerIndex !== -1) {
      const updatedPlayers = [...currentRoom.players]
      updatedPlayers.splice(playerIndex, 1)

      // If room is empty, delete it
      if (updatedPlayers.length === 0) {
        set((state) => {
          const newRooms = { ...state.rooms }
          delete newRooms[roomId]

          return {
            rooms: newRooms,
            currentRoom: null,
            playerSymbol: null,
            isHost: false,
          }
        })
      } else {
        // Update room
        set((state) => ({
          rooms: {
            ...state.rooms,
            [roomId]: {
              ...currentRoom,
              players: updatedPlayers,
              lastUpdateTime: Date.now(),
            },
          },
          currentRoom: null,
          playerSymbol: null,
          isHost: false,
        }))
      }
    } else {
      // Just leave the room (spectator)
      set({
        currentRoom: null,
        playerSymbol: null,
        isHost: false,
      })
    }
  },

  // Make a move
  makeMove: (boardIndex: number, cellIndex: number) => {
    const { currentRoom, playerSymbol } = get()

    if (!currentRoom) return false

    // Check if it's the player's turn
    if (playerSymbol !== currentRoom.currentPlayer || playerSymbol === "spectator") {
      return false
    }

    // Check if the move is valid
    if (currentRoom.gameOver) return false
    if (
      currentRoom.nextBoardIndex !== -1 &&
      currentRoom.nextBoardIndex !== boardIndex &&
      currentRoom.mainBoard[currentRoom.nextBoardIndex] === null
    )
      return false
    if (currentRoom.mainBoard[boardIndex] !== null) return false
    if (currentRoom.boards[boardIndex][cellIndex] !== null) return false

    // Make the move
    const newBoards = JSON.parse(JSON.stringify(currentRoom.boards))
    newBoards[boardIndex][cellIndex] = currentRoom.currentPlayer

    // Check if this move won the small board
    const boardWinner = checkBoardWinner(newBoards[boardIndex])
    const newMainBoard = [...currentRoom.mainBoard]

    if (boardWinner) {
      newMainBoard[boardIndex] = boardWinner
    }

    // Check if this won the game
    let gameOver = currentRoom.gameOver
    let winner = currentRoom.winner

    const gameWinner = checkBoardWinner(newMainBoard as BoardState)
    if (gameWinner) {
      gameOver = true
      winner = gameWinner
    }

    // Check for draw
    if (!gameOver && newMainBoard.every((cell) => cell !== null)) {
      gameOver = true
      winner = "draw"
    }

    // Set the next board to play in
    const nextBoard = newMainBoard[cellIndex] === null ? cellIndex : -1

    // Switch player
    const nextPlayer = currentRoom.currentPlayer === "X" ? "O" : "X"

    // Update room
    const updatedRoom: GameRoom = {
      ...currentRoom,
      boards: newBoards,
      mainBoard: newMainBoard,
      currentPlayer: nextPlayer,
      nextBoardIndex: nextBoard,
      gameOver,
      winner,
      lastMove: { boardIndex, cellIndex },
      lastUpdateTime: Date.now(),
    }

    // Update store
    set((state) => ({
      rooms: {
        ...state.rooms,
        [currentRoom.id]: updatedRoom,
      },
      currentRoom: updatedRoom,
    }))

    return true
  },

  // Reset the game
  resetGame: () => {
    const { currentRoom, playerSymbol } = get()

    if (!currentRoom) return

    // Only host can reset the game
    if (playerSymbol !== "X" && !get().isHost) return

    // Reset the game
    const updatedRoom: GameRoom = {
      ...currentRoom,
      boards: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      mainBoard: Array(9).fill(null),
      currentPlayer: "X",
      nextBoardIndex: -1,
      gameOver: false,
      winner: null,
      lastMove: null,
      lastUpdateTime: Date.now(),
    }

    // Update store
    set((state) => ({
      rooms: {
        ...state.rooms,
        [currentRoom.id]: updatedRoom,
      },
      currentRoom: updatedRoom,
    }))
  },

  // Poll for game state updates
  pollGameState: (roomId: string) => {
    const { rooms, currentRoom } = get()

    // If room doesn't exist, return null
    if (!rooms[roomId]) return null

    const room = rooms[roomId]

    // If current room is more recent, no update needed
    if (currentRoom && currentRoom.id === roomId && currentRoom.lastUpdateTime >= room.lastUpdateTime) {
      return null
    }

    // Return updated room
    return room
  },
}))

export default useMultiplayerStore
