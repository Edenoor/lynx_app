import axios from "axios";

const ApiDelivery = axios.create({
    baseURL: 'http://192.168.1.39:5000',
    headers: {
        'Content-type': 'application/json'
    }
})

export { ApiDelivery}