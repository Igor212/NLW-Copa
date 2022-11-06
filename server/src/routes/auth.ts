import { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "../lib/prisma"
import axios from 'axios'
import { authenticate } from "../plugins/authenticate"

export async function authRoutes(fastify: FastifyInstance){

    fastify.get('/me', {
        onRequest: [authenticate]
    }, 
    async(request) => request.user)

    fastify.post('/users', async(request)=> {
        const createUserBody = z.object({
            accessToken: z.string()
        })

        const userInfoScheme = z.object({
            id: z.string(),
            email: z.string().email(),
            name: z.string(),
            picture: z.string().url()
        })

        const { accessToken } = createUserBody.parse(request.body)

        const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo',{
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
        })

        const userInfo = userInfoScheme.parse(userResponse.data)

        let user = await prisma.user.findUnique({
            where:{
                googleId: userInfo.id
            }
        })

        if(!user){
            user = await prisma.user.create({
                data:{
                    googleId: userInfo.id,
                    name: userInfo.name,
                    email: userInfo.email,
                    avatarUrl: userInfo.picture
                }
            })
        }

        const token = fastify.jwt.sign({
            name: user.name,
            avatarUrl: user.avatarUrl
        },
        {
            sub: user.id,
            expiresIn: '1 day',
        })


        return {token}
    })
}