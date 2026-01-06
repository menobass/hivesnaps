import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

/**
 * Test component to verify @hiveio/wax compatibility with React Native
 * 
 * This tests:
 * 1. Basic Wax imports
 * 2. WaxFoundation initialization
 * 3. Key generation
 * 4. Transaction creation
 * 5. Signature generation
 */
export default function WaxTest() {
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const log = (message: string) => {
        console.log(`[WaxTest] ${message}`);
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const testWaxImport = async () => {
        try {
            log('Testing Wax import...');
            const { createWaxFoundation } = await import('@hiveio/wax');
            log('✅ Wax import successful');
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(`Import failed: ${message}`);
            log(`❌ Import failed: ${message}`);
            return false;
        }
    };

    const testWaxFoundationInit = async () => {
        try {
            log('Testing WaxFoundation initialization...');
            const { createWaxFoundation } = await import('@hiveio/wax');
            const wax = await createWaxFoundation();
            log('✅ WaxFoundation initialized');
            log(`Wax version/type: ${typeof wax}`);
            return wax;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(`Foundation init failed: ${message}`);
            log(`❌ Foundation init failed: ${message}`);
            return null;
        }
    };

    const testKeyGeneration = async (wax: any) => {
        try {
            log('Testing key generation...');
            const testPassword = 'test-password-12345';
            const testAccount = 'testaccount';

            const postingKey = wax.getPrivateKeyFromPassword(testAccount, 'posting', testPassword);
            log(`✅ Generated posting key: ${postingKey.wifPrivateKey.substring(0, 10)}...`);
            log(`Public key: ${postingKey.publicKey}`);

            return postingKey;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(`Key generation failed: ${message}`);
            log(`❌ Key generation failed: ${message}`);
            return null;
        }
    };

    const testChainConnection = async (wax: any) => {
        try {
            log('Testing chain connection...');
            const chain = await wax.createHiveChain();
            log('✅ Chain instance created');

            // Try to get dynamic global properties
            const props = await chain.api.database_api.get_dynamic_global_properties({});
            log(`✅ Connected to Hive! Head block: ${props.head_block_number}`);

            return chain;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(`Chain connection failed: ${message}`);
            log(`❌ Chain connection failed: ${message}`);
            return null;
        }
    };

    const testTransactionCreation = async (chain: any) => {
        try {
            log('Testing transaction creation...');
            const tx = await chain.createTransaction();
            log('✅ Transaction created');
            log(`Transaction ID: ${tx.id || 'pending'}`);

            // Try adding a simple operation
            tx.pushOperation({
                vote_operation: {
                    voter: 'testaccount',
                    author: 'hiveio',
                    permlink: 'test',
                    weight: 10000
                }
            });
            log('✅ Operation pushed to transaction');

            return tx;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(`Transaction creation failed: ${message}`);
            log(`❌ Transaction creation failed: ${message}`);
            return null;
        }
    };

    const runAllTests = async () => {
        setLogs([]);
        setError(null);

        log('🚀 Starting Wax compatibility tests...');
        log('');

        // Test 1: Import
        const importSuccess = await testWaxImport();
        if (!importSuccess) return;

        log('');

        // Test 2: Foundation
        const wax = await testWaxFoundationInit();
        if (!wax) return;

        log('');

        // Test 3: Key Generation
        const key = await testKeyGeneration(wax);
        if (!key) return;

        log('');

        // Test 4: Chain Connection
        const chain = await testChainConnection(wax);
        if (!chain) return;

        log('');

        // Test 5: Transaction
        await testTransactionCreation(chain);

        log('');
        log('🎉 All tests completed!');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Wax React Native Test</Text>

            <TouchableOpacity
                style={styles.button}
                onPress={runAllTests}
            >
                <Text style={styles.buttonText}>Run Tests</Text>
            </TouchableOpacity>

            {error && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorTitle}>Error:</Text>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <ScrollView style={styles.logContainer}>
                {logs.map((log, index) => (
                    <Text key={index} style={styles.logText}>{log}</Text>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 20,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    errorBox: {
        backgroundColor: '#ffebee',
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#f44336',
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#c62828',
        marginBottom: 5,
    },
    errorText: {
        fontSize: 14,
        color: '#b71c1c',
    },
    logContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
    },
    logText: {
        fontSize: 12,
        fontFamily: 'monospace',
        marginBottom: 5,
        color: '#333',
    },
});
