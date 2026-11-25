# ADR-05: Geolocalización y verificación territorial de actas

## Requerimientos relacionados

RF-08, RF-13, RNF-01, S-02

## Contexto

La organización necesita saber dónde se registró cada acta y que el coordinador provincial pueda consultarlo directamente al revisarla, funcionando también cuando el registro inicial se realiza sin conexión, de la misma manera si la geolocalización difiere mucho de otras actas registradas en el mismo recinto se marcará con un indicador para poderla revisar posteriormente.

## Alternativas consideradas

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
|---|---|---|---|
| expo-location, Cálculo de dispersión geográfica (Haversine) con alerta, Mapa interactivo con ReactNative-webView | Bryan Rodrigo Salvador Martinez | Obtiene coordenadas GPS satelitales sin necesidad de internet, mostrando el pin exacto de ubicación, al coordinador provincial sin requerir claves de facturación ni apiKeys. | En Expo Go el WebView registraba dos veces `RNCWebView` durante Fast Refresh; requiere conexión para cargar mosaicos. |
| react-native-geolocation-service | Edwin Chusin | Ocupa servicios de ubiacion de google play, garantizando buena precision y control sobre parametros de consultas. Además de reducir considerablemente el uso de la bateria a comparacion de expo-location. | Depende de servicios/APIs en linea o de un entorno con conectividad. Además, requiere logica propia para acoplar con las reglas de alertas por recinto y la visualizacion interactiva del mapa. |
| GPS (expo location) y Geofencing | Emily Pazmiño | Permite determinar un radio de la ubicación registrada, para restringir la ubicación solo dentro de este radio | La precisión puede varias en zonas rurales, se debe ir almacenando las coordenadas de los recintos |

## Decisión

Usar `expo-location` para registrar las coordenadas y calcular la distancia con Haversine. Mostrar las ubicaciones en un mapa geográfico real con Leaflet y mosaicos de OpenStreetMap dentro del WebView del SDK de Expo (`@expo/dom-webview`), sin claves de facturación ni API key. Se usa el WebView de Expo en lugar de `react-native-webview` porque este último registraba dos veces `RNCWebView` durante Fast Refresh en Expo Go. Cuando no hay conexión o el mapa no carga, se conserva `RelativeMap` con `react-native-svg` como respaldo sobre las coordenadas propias. El mapa no realiza geocodificación ni búsqueda de direcciones y muestra la atribución de OpenStreetMap.

## Consecuencias

Mayor uso del sistema en cuanto a batería, y rendimiento general.

La captura de coordenadas, el cálculo de dispersión y el mapa relativo de respaldo funcionan sin conexión. El mapa con mosaicos reales requiere red para cargar Leaflet y las teselas de OpenStreetMap; muestra la atribución del proveedor y no introduce otro proveedor de mapas. `@expo/dom-webview` forma parte del SDK instalado, por lo que no agrega un módulo nativo nuevo fuera de la decisión.
