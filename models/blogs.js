const mongoose = require('mongoose')
const Schema = mongoose.Schema

const blogSchema = new Schema({

    title:{
        type: String,
        required: true
    },
    categoria: {
        type: String,
        required: true
    },
    snippet:{
        type: String,
        required: true
    },
    body:{
        type: String,
        required: true
    },
    imagePath: {
        type: String, // Almacena la ruta de la imagen subida
        required: true
    }
}, {timestamps:true});

const Blog = mongoose.model('Blog',blogSchema)// Nombre de la colección(mongodb)
module.exports = Blog;