const mongoose = require('mongoose')
const Schema = mongoose.Schema

const productoSchema = new Schema({
    nombre:{
        type: String,
        required: true
    },
    descripcion:{
        type: String,
    },
    precio:{
        type: Number,
        required: true
    },
    imagenUrl:{
        type: String,
    }
}, {timestamps:true});

const Producto = mongoose.model('Producto', productoSchema);

module.exports = Producto;