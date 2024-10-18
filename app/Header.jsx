// GenericHeader.js

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SlidingMenu from './SlidingMenu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GenericHeader = ({ title }) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const insets = useSafeAreaInsets();

    const toggleMenu = () => {
        setMenuVisible(!menuVisible);
    };

    return (
        <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
            <View style={styles.headerContent}>
                {/* Hamburger Icon */}
                <TouchableOpacity onPress={toggleMenu}>
                    <Icon name="menu" size={28} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>{title}</Text>

                {/* Placeholder for alignment */}
                <View style={{ width: 28 }} />
            </View>

            {/* Sliding Menu */}
            <SlidingMenu isVisible={menuVisible} toggleMenu={setMenuVisible} />
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: '#4682b4',
        zIndex: 1,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
});

export default GenericHeader;
