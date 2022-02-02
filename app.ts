import express from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import logger from 'morgan'
import SnowflakeId from "snowflake-id"

import entrypointRouter from './routes/entrypoint'
import { setUserPassword, updateUser } from './src/user'

var app = express()
export const snowflake: { generate: () => string } = new SnowflakeId({
  offset: (2021 - 1970) * 31536000 * 1000
}) as any

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

logger.token('url', (req: any, res: any) => req.path)
app.use(logger('dev') as any)
app.use(express.json() as any)
app.use(express.urlencoded({ extended: false }) as any)
app.use(cookieParser() as any)

app.use('/css', express.static(path.join(__dirname, 'public', 'css')))

app.use(express.static(path.join(__dirname, 'public')))
app.use("/js/bootstrap.min.js", express.static(path.join(__dirname, '/node_modules/bootstrap/dist/js/bootstrap.min.js')))
app.use("/js/popper.min.js", express.static(path.join(__dirname, '/node_modules/@popperjs/core/dist/umd/popper.min.js')))

app.use('/', entrypointRouter)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.status(404).render('404', { title: '404' })
})

// error handler
app.use(function (err: any, req: any, res: any, next: any) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

export default app
