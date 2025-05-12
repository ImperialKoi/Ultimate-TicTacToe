"use client"

import { useState, useEffect, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"

export type Player = "X" | "O" | null
export type BoardState = Player[]
export type UltimateBoardState = (Player | "draw")[]

export type GameRoom = {
  id: string
  players: string[]
  spectators: string[]
  currentPlayer: "X" | "O"
  boards: BoardState[]
  mainBoard: UltimateBoardState
  nextBoardIndex: number
  gameOver: boolean
  winner: "X" | "O" | "draw" | null
  lastMove: { boardIndex: number; cellIndex: number } | null
  lastUpdateTime: number
}

export function useMultiplayer() {
  // Player ID (stored in localStorage to persist across page refreshes)
  const [playerId, setPlayerId] = useState<string>("")

  // Room state
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [playerSymbol, setPlayerSymbol] = useState<"X" | "O" | "spectator" | null>(null)
  const [isHost, setIsHost] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize player ID from localStorage
  useEffect(() => {
    const storedId = localStorage.getItem("ultimateTicTacToePlayerId")
    const id = storedId || uuidv4()

    if (!storedId) {
      localStorage.setItem("ultimateTicTacToePlayerId", id)
    }

    setPlayerId(id)
  }, [])

  // Poll for game updates
  useEffect(() => {
    if (!room) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/game/${room.id}`)

        if (!response.ok) {
          if (response.status === 404) {
            // Room no longer exists
            setRoom(null)
            setPlayerSymbol(null)
            setIsHost(false)
            setError("Game room no longer exists")
          }
          return
        }

        const updatedRoom = await response.json()

        // Only update if the room has changed
        if (updatedRoom.lastUpdateTime > room.lastUpdateTime) {
          setRoom(updatedRoom)
        }
      } catch (err) {
        console.error("Error polling for game updates:", err)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [room])

  // Create a new game room
  const createRoom = useCallback(async () => {
    if (!playerId) return null

    try {
      setError(null)

      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to create room")
        return null
      }

      const data = await response.json()

      setRoom(data.room)
      setPlayerSymbol(data.playerSymbol)
      setIsHost(data.isHost)

      return data.roomId
    } catch (err) {
      console.error("Error creating room:", err)
      setError("Failed to create room")
      return null
    }
  }, [playerId])

  // Join an existing game room
  const joinRoom = useCallback(
    async (roomId: string) => {
      if (!playerId) return { success: false, error: "No player ID" }

      try {
        setError(null)

        const response = await fetch(`/api/game/${roomId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "join",
            playerId,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || "Failed to join room")
          return { success: false, error: data.error || "Failed to join room" }
        }

        const data = await response.json()

        setRoom(data.room)
        setPlayerSymbol(data.playerSymbol)
        setIsHost(data.isHost)

        return { success: true }
      } catch (err) {
        console.error("Error joining room:", err)
        setError("Failed to join room")
        return { success: false, error: "Failed to join room" }
      }
    },
    [playerId],
  )

  // Leave the current game room
  const leaveRoom = useCallback(() => {
    setRoom(null)
    setPlayerSymbol(null)
    setIsHost(false)
  }, [])

  // Make a move in the game
  const makeMove = useCallback(
    async (boardIndex: number, cellIndex: number) => {
      if (!room || !playerId) return false

      try {
        setError(null)

        const response = await fetch(`/api/game/${room.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "move",
            playerId,
            boardIndex,
            cellIndex,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || "Failed to make move")
          return false
        }

        const data = await response.json()
        setRoom(data.room)

        return true
      } catch (err) {
        console.error("Error making move:", err)
        setError("Failed to make move")
        return false
      }
    },
    [room, playerId],
  )

  // Reset the game
  const resetGame = useCallback(async () => {
    if (!room || !playerId) return

    try {
      setError(null)

      const response = await fetch(`/api/game/${room.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reset",
          playerId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Failed to reset game")
        return
      }

      const data = await response.json()
      setRoom(data.room)
    } catch (err) {
      console.error("Error resetting game:", err)
      setError("Failed to reset game")
    }
  }, [room, playerId])

  return {
    // State
    playerId,
    room,
    playerSymbol,
    isHost,
    error,

    // Game state helpers
    boards:
      room?.boards ||
      Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
    mainBoard: room?.mainBoard || Array(9).fill(null),
    currentPlayer: room?.currentPlayer || "X",
    nextBoardIndex: room?.nextBoardIndex || -1,
    gameOver: room?.gameOver || false,
    winner: room?.winner || null,
    lastMove: room?.lastMove || null,
    playerCount: room?.players.length || 0,
    spectatorCount: room?.spectators.length || 0,

    // Actions
    createRoom,
    joinRoom,
    leaveRoom,
    makeMove,
    resetGame,
  }
}
