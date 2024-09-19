import oDapp from 'odapp';
import { appConfig } from '../config/main.configuration.js';

const odapp = new oDapp(appConfig.client.url, true);

export default odapp;
