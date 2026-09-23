const express = require('express')
const server = express()

server.get('/hello', (req, res) => {
    const { nome, idade } = req.query.nome
    return res.json({ 
        title: "Hello World",
        message: `Ola ${nome} meu amigo tudo bem, idade ${idade}`
    })
})

server.get('/hello/:nome', (req, res) => {
    const nome = req.params.nome

    return res.json({ 
        title: "Hello World",
        message: `Ola ${nome} meu amigo tudo bem`
    })
})

server.listen(3000)