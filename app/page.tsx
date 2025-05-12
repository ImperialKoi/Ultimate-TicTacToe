"use client"
import UltimateTicTacToe from "@/components/ultimate-tic-tac-toe"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col">
        <h1 className="text-4xl font-bold mb-8 text-center">Ultimate Tic Tac Toe</h1>
        <UltimateTicTacToe />
      </div>
    </main>
  )
}
