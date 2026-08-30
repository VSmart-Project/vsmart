import { useState, useRef, useCallback } from 'react';
import {
    View, Text, Image, TouchableOpacity, StyleSheet,
    Dimensions, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { markOnboardingDone } from './_layout';

const { width } = Dimensions.get('window');
const IMG_SIZE = width * 0.55;

const SLIDES = [
    {
        id: '1',
        image: require('../assets/icon-1.png'),
        title: 'Explore Global\nLocations',
        subtitle: 'Track all your devices on a real-time map, anytime and anywhere around the world.',
    },
    {
        id: '2',
        image: require('../assets/icon-2.png'),
        title: 'Precise GPS\nTracking',
        subtitle: 'High-accuracy GPS tracking with continuous updates on your device positions.',
    },
    {
        id: '3',
        image: require('../assets/icon-3.png'),
        title: 'Smart\nNotifications',
        subtitle: 'Get instant alerts when devices leave safe zones or unusual activity is detected.',
    },
];

export default function OnboardingScreen() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef(null);
    const insets = useSafeAreaInsets();

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        }
    };

    const handleFinish = () => {
        markOnboardingDone();
    };

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index ?? 0);
        }
    }).current;

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const isLast = currentIndex === SLIDES.length - 1;

    const renderSlide = useCallback(({ item }) => (
        <View style={s.slide}>
            <View style={s.imageCircle}>
                <Image source={item.image} style={s.image} resizeMode="contain" />
            </View>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.subtitle}>{item.subtitle}</Text>
        </View>
    ), []);

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            {/* Skip */}
            {!isLast && (
                <TouchableOpacity style={s.skipBtn} onPress={handleFinish}>
                    <Text style={s.skipText}>Skip</Text>
                </TouchableOpacity>
            )}

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                bounces={false}
                scrollEventThrottle={16}
            />

            {/* Bottom */}
            <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {/* Dots */}
                <View style={s.dots}>
                    {SLIDES.map((_, i) => (
                        <View key={i} style={[s.dot, currentIndex === i && s.dotActive]} />
                    ))}
                </View>

                {/* Button */}
                <TouchableOpacity
                    style={s.mainBtn}
                    onPress={isLast ? handleFinish : handleNext}
                    activeOpacity={0.85}
                >
                    <Text style={s.mainBtnText}>
                        {isLast ? 'Get Started' : 'Continue'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    skipBtn: { position: 'absolute', top: 56, right: 24, zIndex: 10, padding: 8 },
    skipText: { color: '#64748B', fontSize: 15, fontWeight: '600' },

    slide: { width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    imageCircle: {
        width: IMG_SIZE,
        height: IMG_SIZE,
        borderRadius: IMG_SIZE / 2,
        backgroundColor: 'rgba(124,58,237,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 36,
    },
    image: { width: IMG_SIZE * 0.65, height: IMG_SIZE * 0.65 },
    title: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', lineHeight: 38 },
    subtitle: { fontSize: 15, color: '#94A3B8', textAlign: 'center', lineHeight: 24, marginTop: 14, paddingHorizontal: 8 },

    bottom: { paddingHorizontal: 32, paddingTop: 8 },
    dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#334155', marginHorizontal: 5 },
    dotActive: { width: 28, backgroundColor: '#7C3AED' },

    mainBtn: {
        backgroundColor: '#7C3AED',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 8,
    },
    mainBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
});
