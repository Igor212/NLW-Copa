import { FastifyInstance } from "fastify"
import { string, z } from "zod"
import { prisma } from "../lib/prisma"
import { authenticate } from "../plugins/authenticate"

export async function guessRoutes(fastify: FastifyInstance){
    fastify.get('/guesses/count', async() =>{
        const count = await prisma.guess.count()
        return {count}
    })

    fastify.post('/pools/:poolId/games/:gameId/guesses', {
        onRequest: authenticate
    }, async(request, response)=>{
        const createGuessParams = z.object({
            poolId: z.string(),
            gameId: z.string(),
        })

        const createGuessBody = z.object({
            firstTeamPoints: z.number(),
            secondTeamPoints: z.number(),
        })

        const {poolId, gameId} = createGuessParams.parse(request.params)
        const {firstTeamPoints, secondTeamPoints} = createGuessBody.parse(request.body)


        const participant = await prisma.participant.findUnique({
            where:{
                userId_poolId:{
                    poolId,
                    userId: request.user.sub
                }
            }
        })

        if(!participant){
            return response.status(400).send({
                message: 'You are not allowed to create a guess inside this pool'
            })
        }

        const guess = await prisma.guess.findUnique({
            where:{
                participantId_gameId:{
                    gameId,
                    participantId: participant.id
                }
            }
        })

        if(guess){
            return response.status(400).send({
                message: 'You already sent a guess to this game on this pool'
            })
        }

        const game = await prisma.game.findUnique({
            where:{
                id: gameId
            }
        })

        if(!game){
            return response.status(400).send({
                message: 'Game not found'
            })
        }
        
        if(game.date < new Date()){
            return response.status(400).send({
                message: 'You cannot send guesses after the game date'
            })
        }
        
        await prisma.guess.create({
            data:{
                gameId,
                firstTeamPoints,
                secondTeamPoints,
                participantId: participant.id
            }
        })

        return response.status(201).send()
    })
}