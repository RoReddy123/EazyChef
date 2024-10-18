// SlidingMenu.js

import React, { useEffect, useRef } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    Animated, 
    PanResponder, 
    TouchableWithoutFeedback, 
    Dimensions,
    TouchableOpacity,
    SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router'; // Ensure expo-router is installed and configured
import Icon from 'react-native-vector-icons/MaterialIcons';

const { height, width } = Dimensions.get('window');

const SlidingMenu = ({ isVisible, toggleMenu }) => {
    const router = useRouter();
    const slideAnim = useRef(new Animated.Value(-width * 0.8)).current; // Adjusted to occupy 80% of screen width

    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: isVisible ? 0 : -width * 0.8,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [isVisible]);

    const handlePress = (route) => {
        toggleMenu(false);
        router.push(route);
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Detect swipe to the right to open the menu
                return gestureState.dx > 20;
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx > 100) {
                    toggleMenu(true);
                } else {
                    toggleMenu(false);
                }
            },
        })
    ).current;

    if (!isVisible) {
        return null; // Do not render anything if not visible
    }

    return (
        <View style={styles.overlay}>
            {/* Slide the menu first to position it on the left */}
            <Animated.View
                style={[
                    styles.menu,
                    { transform: [{ translateX: slideAnim }] },
                ]}
                {...panResponder.panHandlers}
            >
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        <TouchableWithoutFeedback onPress={() => toggleMenu(false)}>
                            <Icon name="arrow-back" size={30} color="#fff" />
                        </TouchableWithoutFeedback>
                        <Text style={styles.headerText}>Menu</Text>
                    </View>

                    <View style={styles.separator} />
                    
                    {/* Menu Items Container */}
                    <View style={styles.menuItemsContainer}>
                        <TouchableOpacity onPress={() => handlePress('MyRecipes')}>
                            <Text style={styles.menuItem}>My Recipes</Text>
                        </TouchableOpacity>
                        <View style={styles.separator} />
                        
                        <TouchableOpacity onPress={() => handlePress('Nutrition')}>
                            <Text style={styles.menuItem}>Nutrition</Text>
                        </TouchableOpacity>
                        <View style={styles.separator} />
                        
                        <TouchableOpacity onPress={() => handlePress('Tutorial')}>
                            <Text style={styles.menuItem}>Tutorial</Text>
                        </TouchableOpacity>
                        <View style={styles.separator} />
                    </View>

                    {/* Spacer to push the Log Out button upwards */}
                    <View style={{ flex: 1 }} />

                    {/* Log Out Button */}
                    <TouchableOpacity onPress={() => handlePress('LoginScreen')}>
                        <View style={styles.logoutButtonContainer}>
                            <Text style={styles.logoutButtonText}>Log Out</Text>
                        </View>
                    </TouchableOpacity>
                    <View style={styles.separator} />
                </SafeAreaView>
            </Animated.View>

            {/* Overlay Touchable area should come after the menu */}
            <TouchableWithoutFeedback onPress={() => toggleMenu(false)}>
                <View style={styles.overlayTouchable} />
            </TouchableWithoutFeedback>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: width,
        height: height,
        zIndex: 100,
        flexDirection: 'row', // Keep flexDirection as 'row'
    },
    overlayTouchable: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    menu: {
        width: width * 0.5, // Updated to 80% as per initial slideAnim
        height: height,
        backgroundColor: '#6B86B9',
        padding: 20,
        zIndex: 101,
        justifyContent: 'flex-start',
        paddingBottom: 30, // Added padding at the bottom to account for navigation tab
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        // Removed marginTop to let SafeAreaView handle top padding
    },
    headerText: {
        fontSize: 20,
        color: '#fff',
        marginLeft: 10,
    },
    menuItemsContainer: {
        // Optional: Add styles if needed
    },
    menuItem: {
        paddingVertical: 15,
        fontSize: 18,
        color: '#fff',
    },
    separator: {
        height: 1,
        backgroundColor: '#fff',
        marginVertical: 5,
    },
    logoutButtonContainer: {
        backgroundColor: '#fff',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 5,
        marginHorizontal: 10, // Padding from the sides
        alignItems: 'center',
        marginBottom: 60, // Added margin to lift the button above the navigation tab
    },
    logoutButtonText: {
        fontSize: 18,
        color: '#0000FF', // Assuming you want blue text on white background
        fontWeight: 'bold',
    },
});

export default SlidingMenu;
