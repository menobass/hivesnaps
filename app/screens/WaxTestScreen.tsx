import { Stack } from 'expo-router';
import WaxTest from '../../components/WaxTest';

export default function WaxTestScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Wax Compatibility Test' }} />
            <WaxTest />
        </>
    );
}
