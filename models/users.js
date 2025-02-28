const mongoose = require('mongoose')
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema

const usersSchema = new Schema({
    Correo:{
        type: String,
        required: true
    },
    password: { 
        type: String, 
        required: true 
    }
}, {timestamps:true});


//Para encriptar la contraseña antes de guardar el usuario
usersSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

//comparar contraseñas
usersSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

// mostrar las contraseñas en la pagina segura
usersSchema.methods.desencriptarContrasena = async function () {
    return bcrypt.compare(this.password, this.password); // Simula el proceso inverso
};

const Usuarios = mongoose.model('user', usersSchema)// Nombre de la colección(mongodb)
module.exports = Usuarios;