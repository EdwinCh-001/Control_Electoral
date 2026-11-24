# Requerimientos no funcionales

| ID | Requerimiento | Origen |
|---|---|---|
| RNF-01 | La aplicacion es offline-first. Captura, valida y conserva actas y fotografias localmente sin internet. Al recuperar conectividad, procesa la cola en dos fases (OCR y sincronizacion, con revision humana antes de enviar). Los pendientes sobreviven al cierre y admiten reintentos. Android puede diferir la ejecucion en segundo plano; no se garantiza una hora exacta de ejecucion mientras el sistema operativo la suspenda. | Seccion 3.6: Conectividad el dia de la eleccion |
| RNF-02 | Las politicas de seguridad del servidor y el almacenamiento aislan actas y fotografias segun la jurisdiccion, el recinto y las mesas autorizadas. | Seccion 3.4: Confidencialidad de la informacion |
| RNF-03 | Firebase Crashlytics reporta cierres y errores funcionales no fatales, incluyendo fallos de subida de fotografias u OCR. Los reportes deben incluir modelo del dispositivo, version de Android y pantalla activa, conservarse offline y enviarse al recuperar conectividad; no deben incluir datos sensibles. | Seccion 3.7: Estabilidad de la aplicacion |
| RNF-04 | La aplicacion se desarrolla en React Native, organizada bajo Clean Architecture, y se entrega como APK instalable para Android. | Restricciones obligatorias del proyecto |
