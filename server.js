import express from 'express'
import { ApolloServer, gql } from 'apollo-server-express'
import { GraphQLUpload, graphqlUploadExpress } from 'graphql-upload'
import path from 'path'
import fs from 'fs'
import shortid from 'shortid'

const typeDefs = gql`
  scalar Upload

  type File {
    filename: String!
    mimetype: String!
    encoding: String!
  }

  type Query {
    hello: String!
  }

  type Mutation {
    # Multiple uploads are supported. See graphql-upload docs for details.
    singleUpload(file: Upload!): File!
    uploadFile(file: Upload!): String
  }
`

const resolvers = {
  // This maps the `Upload` scalar to the implementation provided
  // by the `graphql-upload` package.
  Upload: GraphQLUpload,

  Query: {
    hello: () => 'Hello World!'
  },

  Mutation: {
    singleUpload: async (parent, { file }) => {
      const { createReadStream, filename, mimetype, encoding } = await file

      // Invoking the `createReadStream` will return a Readable Stream.
      // See https://nodejs.org/api/stream.html#stream_readable_streams
      const stream = createReadStream()

      // This is purely for demonstration purposes and will overwrite the
      // local-file-output.txt in the current working directory on EACH upload.
      const out = fs.createWriteStream('local-file-output.txt')
      await stream.pipe(out)

      return { filename, mimetype, encoding }
    },

    uploadFile: async (_, { file }) => {
      const { filename, createReadStream } = await file
      const id = shortid.generate()
      const { ext, name } = path.parse(filename)
      const stream = createReadStream()
      const filePath = path.join(
        __dirname,
        `./public/images/${name}-${id}${ext}`
      )
      console.log(filePath)
      const writeStream = fs.createWriteStream(filePath)
      await stream.pipe(writeStream)
      return `http://localhost:4000/images/${name}-${id}${ext}`
    }
  }
}

async function startServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    playground: true,
    introspection: true,
    debug: true,
    cors: { credentials: true, allowedHeaders: '', origin: '*' },
    context: ({ req, res }) => ({ req, res })
  })
  await server.start()

  const app = express()

  // This middleware should be added before calling `applyMiddleware`.
  app.use(graphqlUploadExpress())

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200)
    }
    next()
  })

  server.applyMiddleware({ app })

  app.use(express.static('public'))

  await new Promise((r) => app.listen({ port: 4000 }, r))

  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
}

startServer()
