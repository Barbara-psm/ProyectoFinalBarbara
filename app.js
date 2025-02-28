// Importar dependencias
const express = require('express')
const app = express()
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy
const morgan = require('morgan');
const fs = require('fs')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs');
const User = require('./models/users')
const Producto = require('./models/productos');
const Blog = require('./models/blogs');
const path = require('path')
const methodOverride = require('method-override')
const multer = require('multer');
const paypal = require('@paypal/checkout-server-sdk'); //libreria de PAYPAL
const PORT = process.env.PORT || 3000

// Configuración de multer para manejar la subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads'); // Guardar las imágenes en la carpeta 'uploads'
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname); // Obtener la extensión del archivo
        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`; // Generar un nombre único
        cb(null, filename);
    }
});

const upload = multer({ storage }); // Inicializar multer con la configuración de almacenamiento

module.exports = upload;

var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' }) //para escribir en el access.log

// Configurar variables de entorno
require('dotenv').config();

// Iniciar el servidor y Conectar a MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => app.listen(PORT, () => console.log(`Servidor conectado a http://localhost:${PORT}`)))
    .catch((error) => console.log('Error al conectar con MongoDB', error));

app.set('view engine', 'ejs') // registrar EJS

app.set('views', 'vistas') // especificar la carpeta que contiene las vistas

app.use(express.static('public')); // middleware para archivos estáticos
app.use('/img', express.static('img'));
app.use(express.static('uploads'));
app.use(express.urlencoded({ extended: true })); // middleware para parsear el cuerpo de las solicitudes
app.use(express.json());
app.use(morgan('dev', { stream: accessLogStream }))
app.use(methodOverride('_method'));

app.use(session({
    secret: process.env.SECRET_SESSION,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}))

app.use(passport.initialize());
app.use(passport.session());

// Configurar passport
passport.use(new LocalStrategy(
    { usernameField: 'Correo', passwordField: 'Contrasena' },
    async (Correo, Contrasena, done) => {
        try {
            const user = await User.findOne({ Correo });
            if (!user) {
                return done(null, false, { message: 'Correo no registrado' });
            }
            const isMatch = await bcrypt.compare(Contrasena, user.Contrasena);
            if (!isMatch) {
                return done(null, false, { message: 'Contraseña incorrecta' });
            }
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
));

//serialización del usuario
passport.serializeUser ((user, done) =>{
    done(null, user.id);
})

//deserializacion del usuario
passport.deserializeUser ((async(id, done) =>{
    try {
        const user = await User.findById(id)
        done (null, user)
    } catch (error) {
        done(error)
    }
}))

// Configuración de PayPal
const Environment = paypal.core.SandboxEnvironment;
const PaypalClient = new paypal.core.PayPalHttpClient(new Environment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET,
));

// Página principal
app.get('/', function (req, res) {
    User.find()
        .then((resultado) => {
            res.render('index', { title: 'Inicio', stylesheet: '/estiloIndex.css' });
        })
        .catch((error) => {
            console.log(error)
        })
});

// Mostrar todos los blogs
app.get('/blogs', async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1 }); // Ordenar por fecha de creación
        res.render('blogs', { blogs, title: 'Blogs', stylesheet: '/estiloBlogs.css' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar los blogs');
    }
});

// Crear blogs
app.get('/blogs/crear', function (req, res) {
    User.find()
        .then((resultado) => {
            res.render('crearBlog', { title: 'Crear Blog', stylesheet: '/estiloCrearBlogs.css', error: null });
        })
        .catch((error) => {
            console.log(error)
        })
});

// Crear blogs (usando multer para manejar la subida de imágenes)
app.post('/blogs', upload.single('image'), async (req, res) => {
    try {
        console.log(req.file); // Verifica que multer está recibiendo el archivo correctamente

        const { title, snippet, body, categoria } = req.body;

        // Validar que se haya seleccionado una categoría
        if (!categoria || categoria === "") {
            return res.render('crearBlog', {
                title: 'Crear Blog',
                stylesheet: '/estiloCrearBlogs.css',
                error: 'Por favor, selecciona una categoría.' // Pasar el mensaje de error
            });
        }

        const imagePath = req.file ? req.file.filename : null; // Obtener el nombre del archivo subido

        const newBlog = new Blog({
            title,
            snippet,
            body,
            categoria,
            imagePath
        });

        await newBlog.save();
        res.redirect('/blogs');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al crear el blog');
    }
});

// Mostrar un blog en detalle
app.get('/blogs/:id', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).send('Blog no encontrado');
        }
        console.log(blog); // Verifica el valor de imagePath en la consola
        res.render('blogDetalle', { blog, title: blog.title, stylesheet: '/estiloBlogDetalle.css',});
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el blog');
    }
});

// Eliminar un blog
app.get('/blogs/:id/eliminar', async (req, res) => {
    try {
        await Blog.findByIdAndDelete(req.params.id);
        res.redirect('/blogs');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al eliminar el blog');
    }
});

// Redirigir a la vista de edición del blog
app.get('/blogs/:id/editar', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).send('Blog no encontrado');
        }
        res.render('editarBlog', { blog, title: 'Editar', stylesheet: '/estiloEditarBlog.css' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el blog para editar');
    }
});

// Actualizar un blog
app.put('/blogs/:id', upload.single('image'), async (req, res) => {
    try {
        console.log("Datos recibidos:", req.body);
        const id = req.params.id;
        const { title, snippet, body } = req.body;

        // Buscar el blog actual
        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).send('Blog no encontrado');
        }

        // Actualizar los campos del blog
        blog.title = title;
        blog.snippet = snippet;
        blog.body = body;

        // Si se subió una nueva imagen, actualizar la ruta de la imagen
        if (req.file) {
            blog.imagePath = req.file.filename;
        }

        // Guardar los cambios en la base de datos
        await blog.save();

        // Redirigir a la página de detalles del blog
        res.redirect(`/blogs/${id}`);
    } catch (error) {
        console.error('Error al actualizar el blog:', error);
        res.status(500).send('Error al actualizar el blog');
    }
});

// Mostrar el catalogo
app.get('/catalogo', async (req, res) => {
    try {
        const productos = await Producto.find().sort({ createdAt: -1 })
        const cesta = req.session.cesta || []
        const cestaCantidad = cesta.reduce((total,item) => total + item.cantidad,0)
        res.render('catalogo', { title: 'Catálogo', productos, cestaCantidad, stylesheet: '/estiloCatalogo.css' });
    } catch (error) {
        console.error('error al obtener los productos', error)
        res.status(500).send('error al cargar los productos')
    }
});

// Manejar el añadir productos a la cesta
app.post('/add-to-cart', async (req,res) => {
    // Imprimir el cuerpo de la solicitud para comprobar que se reciben los datos correctos
    console.log('Cuerpo de la solicitud:', req.body);

    const { productoId, cantidad } = req.body;
    const cantidadInt = parseInt(cantidad, 10);
    
    // Verificar que la cantidad es válida
    console.log('Cantidad recibida:', cantidadInt);

    const producto = await Producto.findById(productoId);
    
    // Comprobar si el producto fue encontrado
    if (!producto) {
        console.log('Producto no encontrado para el ID:', productoId);
        return res.status(404).send('Producto no encontrado');
    }
    console.log('Producto encontrado:', producto);

    // Asegurarse de que la cesta esté definida
    req.session.cesta = req.session.cesta || [];
    console.log('Cesta antes de añadir producto:', req.session.cesta);

    // Buscar si el producto ya está en la cesta
    const productoExistente = req.session.cesta.find(item => item.productoId == productoId);
    console.log('Producto existente en la cesta:', productoExistente);

    if (productoExistente) {
        // Si el producto ya existe en la cesta, se incrementa la cantidad
        productoExistente.cantidad += cantidadInt;
        console.log('Producto actualizado en la cesta:', productoExistente);
    } else {
        // Si no existe, se agrega a la cesta
        req.session.cesta.push({
            productoId,
            nombre: producto.nombre,
            precio: producto.precio,
            imagenUrl: producto.imagenUrl,
            cantidad: cantidadInt
        });
        console.log('Producto agregado a la cesta:', req.session.cesta);
    }

    // Imprimir la cesta final después de la modificación
    console.log('Cesta después de modificarla:', req.session.cesta);

    // Guardar la sesión y redirigir
    req.session.save(err => {
        if (err) {
            console.log('Error al guardar la sesión:', err);
            return res.status(500).send('Error al actualizar la cesta');
        }
        console.log('Cesta actualizada y sesión guardada correctamente');
        req.session.save(err => err ? res.status(500).send ('Error al actualizar la cesta'): res.redirect('/catalogo'))
    });
});

// Vista de Cesta
app.get('/cesta', async (req, res) => {
    try {
        res.render('cesta', {title:'Cesta', cesta: req.session.cesta || [], stylesheet: '/estiloCesta.css'})
    } catch (error) {
        console.error('Error al acceder a la cesta', error)
        res.status(500).send('Error al acceder al carrito')
    }
})

// Eliminar un producto de la cesta
app.post('/cesta/eliminar', async(req,res) => {
    req.session.cesta = req.session.cesta.filter(item => item.productoId !== req.body.productoId)
    req.session.save(err => err ? rmSync.status(500).send('Error al eliminar el producto'): res.redirect('/cesta'))
})

// Vaciar toda la cesta
app.post('/cesta/vaciar', async(req,res) => {
    req.session.cesta = []
    req.session.save(err => err ? rmSync.status(500).send('Error al vaciar la cesta'): res.redirect('/cesta'))
})

// Success después de realizar el pago
app.get('/success', async(req,res) => {
    const {token} = req.query
    const request = new paypal.orders.OrdersCaptureRequest(token)
    request.requestBody({})
    try {
        const capture = await PaypalClient.execute(request)
        const payment = capture.result
        console.log('Respuesta completa de Paypal: ', JSON.stringify(payment, null, 2))

        // Obtener ID y total del pago
        const idPago = payment.id || (payment.purchase_units[0].payments.captures[0].id || 'ID no disponible')
        const total = payment.purchase_units[0].payments.captures[0].amount.value

        // Obtener dirección
        const shipping = payment.purchase_units[0].shipping
        const direccion = {
            recipient_name: shipping?.name?.full_name || 'No disponible',
            line1: shipping?.address?.address_line_1 || 'No disponible',
            city: shipping?.address?.admin_area_2 || 'No disponible',
            state: shipping?.address?.admin_area_1 || 'No disponible',
            postal_code: shipping?.address?.postal_code || 'No disponible',
            country_code: shipping?.address?.country_code || 'No disponible'
        }

        //Obtener productos
        const productos = payment.purchase_units[0].payments?.captures[0]?.seller_receivable_breakdown?.items || []
        const factura = `INV-${Math.floor(Math.random()*1000000)}`

        //Vaciar cesta
        req.session.cesta=[]

        res.render('success',{
            factura,
            idPago,
            productos,
            total,
            direccion, title: 'Editar', stylesheet: '/estiloEditarBlog.css'
        })

    } catch (error) {
        console.error('Error ejecutando el pago', error)
        res.status(500).send('Error al realizar el pago.')
    }
})

// Ruta para registrar un nuevo usuario
app.get('/sign-up', (req, res)=>{
    res.render('sign-up', {title: 'Sign-up', stylesheet: '/estiloRegistro.css'})
})

// Middleware de autenticación
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next(); // El usuario está autenticado, continúa con la solicitud
    }
    res.redirect('/login'); // Si no está autenticado, redirige al login
}

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login'); // Redirigir al login si no está autenticado
}

// Usar el middleware en una ruta protegida
app.get('/private', isAuthenticated, (req, res) => {
    res.render('private', { user: req.user, title: 'Ruta protegida', stylesheet: '/estiloPrivate.css'  });
});

app.get('/login', (req, res) => {
    res.render('login', { title: 'Login', stylesheet: '/estiloLogin.css' });
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/basededatos',
    failureRedirect: '/login',
    failureFlash: true
}), async (req, res) => {
    await Activity.create({ 
        userId: req.user.id, 
        action: 'Login', 
        ip: req.ip
    });
});

// Ruta de logout
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.post('/sign-up', async (req, res) => {
    console.log(req.body);
    const { Correo, password } = req.body;

    // Verificar si los campos necesarios están presentes
    if (!Correo || !password ) {
        return res.status(400).send('Faltan campos obligatorios');
    }

    try {
        // Verificar si el correo ya está registrado
        const existingUser = await User.findOne({ Correo });
        if (existingUser) {
            return res.status(400).send('El correo ya está registrado.');
        }

        // Encriptar la contraseña antes de guardar
        await nuevoUsuario.save();

        // Responder con éxito
        res.status(201).send('Usuario registrado con éxito');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al registrar el usuario');
    }
});

app.post('/sign-up', function (req, res) {

    console.log(req.body);  // Verifica los datos recibidos

    const user = new User(req.body)

    user.save()
        .then((resultado) => {
            res.redirect('/') //redirigir a la página de inicio
        })
        .catch((error) => {
            console.error("Error al guardar el usuario:", error);
            res.status(500).send('Error al guardar el usuario');
        })

});

//404
app.use((req, res) => {
    res.status(404).render('404', { title: 'error', stylesheet: '/estilo404.css' });
})
