import fetch from 'node-fetch';
import { performance } from 'perf_hooks';
import { awaitAll, filter, map, prop, sortBy } from '../util';
import {ENDPOINT_TYPE, NETWORK_TYPE} from "../types";

let networkMetadata: INetworkMetadata | null = null

interface INetworkMetadata {
    "chain_name": string;
    "status": string;
    "network_type": string;
    "pretty_name": string;
    "chain_id": string;
    "bech32_prefix": string;
    "daemon_name": string;
    "node_home": string;
    "genesis": {
        "genesis_url": string
    };
    "codebase": {
        "git_repo": string,
        "recommended_version": string,
        "compatible_versions": [string],
        "binaries": {
            [target: string]: string
        }
    },
    "peers": {
        "seeds": [
            {
                "id": string,
                "address": string
            },
        ],
        "persistent_peers": [
            {
                "id": string,
                "address": string
            },
        ]
    },
    "apis": {
        [type: string]: [{ "address": string }],
    }
}

export async function getMetadata(network: NETWORK_TYPE): Promise<INetworkMetadata> {
    if (networkMetadata) {
        return networkMetadata
    } else {
        return fetch(`https://raw.githubusercontent.com/ovrclk/net/master/${network}/meta.json`)
            .then(res => res.json())
            .then(res => {
                networkMetadata = res;
                return res;
            })
            .catch(err => {
                throw err
            });
    }

}

export function getEndpoints(network: NETWORK_TYPE, type: ENDPOINT_TYPE) {
    return getMetadata(network)
        .then(meta => meta.apis[type]);
}

export function getEndpointsSorted(network: NETWORK_TYPE, type: ENDPOINT_TYPE) {
    return getEndpoints(network, type)
        .then(map(getEndpointHealthStatus(800)))
        .then(awaitAll)
        .then(filter(isNodeResponsive))
        .then(sortBy(prop("responseTime")));
}

function isNodeResponsive(endpoint: { responseTime: number | null }) {
    return endpoint.responseTime !== null;
}

function getEndpointHealthStatus(timeout: number) {
    return ({ address }: { "address": string }) => {
        const startTime = performance.now();

        return fetch(`${address}/node_info`, { timeout })
            .then(
                () => ({
                    address,
                    responseTime: Math.floor(performance.now() - startTime)
                }))
            .catch(
                () => ({
                    address,
                    responseTime: null
                })
            );
    }
}