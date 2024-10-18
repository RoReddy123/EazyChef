import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import React from 'react';

export default function CategoryItem({ category, onCategoryPress }) {
    return (
        <TouchableOpacity onPress={() => onCategoryPress(category)} style={styles.container}>
            <View style={styles.iconContainer}>
                <Image
                    source={{ uri: category.icon }}
                    style={styles.icon}
                    resizeMode="cover" // Ensure the image scales correctly
                />
            </View>
            <Text style={styles.categoryName}>{category.name}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center', // Center the icon and text horizontally
        marginRight: 10, // Reduced margin between items
    },
    iconContainer: {
        padding: 15,
        backgroundColor: '#add8e6',
        borderRadius: 99,
        justifyContent: 'center',
        alignItems: 'center', // Center the image inside the container
    },
    icon: {
        width: 40,
        height: 40,
        borderRadius: 20, // Optional: makes the image round
    },
    categoryName: {
        fontSize: 12,
        fontFamily: 'outfit-medium',
        textAlign: 'center',
        marginTop: 5,
    },
});
