/* three.js r128 examples（EffectComposer、UnrealBloomPass，MIT）*/
( function () {

	/**
 * Full-screen textured quad shader
 */
	var CopyShader = {
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'opacity': {
				value: 1.0
			}
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;

		}`
	};

	THREE.CopyShader = CopyShader;

} )();
( function () {

	/**
 * Luminosity
 * http://en.wikipedia.org/wiki/Luminosity
 */

	const LuminosityHighPassShader = {
		shaderID: 'luminosityHighPass',
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'luminosityThreshold': {
				value: 1.0
			},
			'smoothWidth': {
				value: 1.0
			},
			'defaultColor': {
				value: new THREE.Color( 0x000000 )
			},
			'defaultOpacity': {
				value: 0.0
			}
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`
	};

	THREE.LuminosityHighPassShader = LuminosityHighPassShader;

} )();
( function () {

	class EffectComposer {

		constructor( renderer, renderTarget ) {

			this.renderer = renderer;

			if ( renderTarget === undefined ) {

				const parameters = {
					minFilter: THREE.LinearFilter,
					magFilter: THREE.LinearFilter,
					format: THREE.RGBAFormat
				};
				const size = renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = new THREE.WebGLRenderTarget( this._width * this._pixelRatio, this._height * this._pixelRatio, parameters );
				renderTarget.texture.name = 'EffectComposer.rt1';

			} else {

				this._pixelRatio = 1;
				this._width = renderTarget.width;
				this._height = renderTarget.height;

			}

			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.renderTarget2.texture.name = 'EffectComposer.rt2';
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;
			this.renderToScreen = true;
			this.passes = []; // dependencies

			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.CopyShader' );

			}

			if ( THREE.ShaderPass === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.ShaderPass' );

			}

			this.copyPass = new THREE.ShaderPass( THREE.CopyShader );
			this.clock = new THREE.Clock();

		}

		swapBuffers() {

			const tmp = this.readBuffer;
			this.readBuffer = this.writeBuffer;
			this.writeBuffer = tmp;

		}

		addPass( pass ) {

			this.passes.push( pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}

		insertPass( pass, index ) {

			this.passes.splice( index, 0, pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}

		removePass( pass ) {

			const index = this.passes.indexOf( pass );

			if ( index !== - 1 ) {

				this.passes.splice( index, 1 );

			}

		}

		isLastEnabledPass( passIndex ) {

			for ( let i = passIndex + 1; i < this.passes.length; i ++ ) {

				if ( this.passes[ i ].enabled ) {

					return false;

				}

			}

			return true;

		}

		render( deltaTime ) {

			// deltaTime value is in seconds
			if ( deltaTime === undefined ) {

				deltaTime = this.clock.getDelta();

			}

			const currentRenderTarget = this.renderer.getRenderTarget();
			let maskActive = false;

			for ( let i = 0, il = this.passes.length; i < il; i ++ ) {

				const pass = this.passes[ i ];
				if ( pass.enabled === false ) continue;
				pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass( i );
				pass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive );

				if ( pass.needsSwap ) {

					if ( maskActive ) {

						const context = this.renderer.getContext();
						const stencil = this.renderer.state.buffers.stencil; //context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );

						stencil.setFunc( context.NOTEQUAL, 1, 0xffffffff );
						this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime ); //context.stencilFunc( context.EQUAL, 1, 0xffffffff );

						stencil.setFunc( context.EQUAL, 1, 0xffffffff );

					}

					this.swapBuffers();

				}

				if ( THREE.MaskPass !== undefined ) {

					if ( pass instanceof THREE.MaskPass ) {

						maskActive = true;

					} else if ( pass instanceof THREE.ClearMaskPass ) {

						maskActive = false;

					}

				}

			}

			this.renderer.setRenderTarget( currentRenderTarget );

		}

		reset( renderTarget ) {

			if ( renderTarget === undefined ) {

				const size = this.renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = this.renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = this.renderTarget1.clone();
				renderTarget.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

			}

			this.renderTarget1.dispose();
			this.renderTarget2.dispose();
			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;

		}

		setSize( width, height ) {

			this._width = width;
			this._height = height;
			const effectiveWidth = this._width * this._pixelRatio;
			const effectiveHeight = this._height * this._pixelRatio;
			this.renderTarget1.setSize( effectiveWidth, effectiveHeight );
			this.renderTarget2.setSize( effectiveWidth, effectiveHeight );

			for ( let i = 0; i < this.passes.length; i ++ ) {

				this.passes[ i ].setSize( effectiveWidth, effectiveHeight );

			}

		}

		setPixelRatio( pixelRatio ) {

			this._pixelRatio = pixelRatio;
			this.setSize( this._width, this._height );

		}

	}

	class Pass {

		constructor() {

			// if set to true, the pass is processed by the composer
			this.enabled = true; // if set to true, the pass indicates to swap read and write buffer after rendering

			this.needsSwap = true; // if set to true, the pass clears its buffer before rendering

			this.clear = false; // if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.

			this.renderToScreen = false;

		}

		setSize( ) {}

		render( ) {

			console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

		}

	} // Helper for passes that need to fill the viewport with a single quad.


	const _camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 ); // https://github.com/mrdoob/three.js/pull/21358


	const _geometry = new THREE.BufferGeometry();

	_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );

	_geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );

	class FullScreenQuad {

		constructor( material ) {

			this._mesh = new THREE.Mesh( _geometry, material );

		}

		dispose() {

			this._mesh.geometry.dispose();

		}

		render( renderer ) {

			renderer.render( this._mesh, _camera );

		}

		get material() {

			return this._mesh.material;

		}

		set material( value ) {

			this._mesh.material = value;

		}

	}

	THREE.EffectComposer = EffectComposer;
	THREE.FullScreenQuad = FullScreenQuad;
	THREE.Pass = Pass;

} )();
( function () {

	class RenderPass extends THREE.Pass {

		constructor( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

			super();
			this.scene = scene;
			this.camera = camera;
			this.overrideMaterial = overrideMaterial;
			this.clearColor = clearColor;
			this.clearAlpha = clearAlpha !== undefined ? clearAlpha : 0;
			this.clear = true;
			this.clearDepth = false;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();

		}

		render( renderer, writeBuffer, readBuffer
			/*, deltaTime, maskActive */
		) {

			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			let oldClearAlpha, oldOverrideMaterial;

			if ( this.overrideMaterial !== undefined ) {

				oldOverrideMaterial = this.scene.overrideMaterial;
				this.scene.overrideMaterial = this.overrideMaterial;

			}

			if ( this.clearColor ) {

				renderer.getClearColor( this._oldClearColor );
				oldClearAlpha = renderer.getClearAlpha();
				renderer.setClearColor( this.clearColor, this.clearAlpha );

			}

			if ( this.clearDepth ) {

				renderer.clearDepth();

			}

			renderer.setRenderTarget( this.renderToScreen ? null : readBuffer ); // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600

			if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
			renderer.render( this.scene, this.camera );

			if ( this.clearColor ) {

				renderer.setClearColor( this._oldClearColor, oldClearAlpha );

			}

			if ( this.overrideMaterial !== undefined ) {

				this.scene.overrideMaterial = oldOverrideMaterial;

			}

			renderer.autoClear = oldAutoClear;

		}

	}

	THREE.RenderPass = RenderPass;

} )();
( function () {

	class ShaderPass extends THREE.Pass {

		constructor( shader, textureID ) {

			super();
			this.textureID = textureID !== undefined ? textureID : 'tDiffuse';

			if ( shader instanceof THREE.ShaderMaterial ) {

				this.uniforms = shader.uniforms;
				this.material = shader;

			} else if ( shader ) {

				this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );
				this.material = new THREE.ShaderMaterial( {
					defines: Object.assign( {}, shader.defines ),
					uniforms: this.uniforms,
					vertexShader: shader.vertexShader,
					fragmentShader: shader.fragmentShader
				} );

			}

			this.fsQuad = new THREE.FullScreenQuad( this.material );

		}

		render( renderer, writeBuffer, readBuffer
			/*, deltaTime, maskActive */
		) {

			if ( this.uniforms[ this.textureID ] ) {

				this.uniforms[ this.textureID ].value = readBuffer.texture;

			}

			this.fsQuad.material = this.material;

			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( writeBuffer ); // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600

				if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
				this.fsQuad.render( renderer );

			}

		}

	}

	THREE.ShaderPass = ShaderPass;

} )();
( function () {

	/**
 * UnrealBloomPass is inspired by the bloom pass of Unreal Engine. It creates a
 * mip map chain of bloom textures and blurs them with different radii. Because
 * of the weighted combination of mips, and because larger blurs are done on
 * higher mips, this effect provides good quality and performance.
 *
 * Reference:
 * - https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */

	class UnrealBloomPass extends THREE.Pass {

		constructor( resolution, strength, radius, threshold ) {

			super();
			this.strength = strength !== undefined ? strength : 1;
			this.radius = radius;
			this.threshold = threshold;
			this.resolution = resolution !== undefined ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 ); // create color only once here, reuse it later inside the render function

			this.clearColor = new THREE.Color( 0, 0, 0 ); // render targets

			const pars = {
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				format: THREE.RGBAFormat
			};
			this.renderTargetsHorizontal = [];
			this.renderTargetsVertical = [];
			this.nMips = 5;
			let resx = Math.round( this.resolution.x / 2 );
			let resy = Math.round( this.resolution.y / 2 );
			this.renderTargetBright = new THREE.WebGLRenderTarget( resx, resy, pars );
			this.renderTargetBright.texture.name = 'UnrealBloomPass.bright';
			this.renderTargetBright.texture.generateMipmaps = false;

			for ( let i = 0; i < this.nMips; i ++ ) {

				const renderTargetHorizonal = new THREE.WebGLRenderTarget( resx, resy, pars );
				renderTargetHorizonal.texture.name = 'UnrealBloomPass.h' + i;
				renderTargetHorizonal.texture.generateMipmaps = false;
				this.renderTargetsHorizontal.push( renderTargetHorizonal );
				const renderTargetVertical = new THREE.WebGLRenderTarget( resx, resy, pars );
				renderTargetVertical.texture.name = 'UnrealBloomPass.v' + i;
				renderTargetVertical.texture.generateMipmaps = false;
				this.renderTargetsVertical.push( renderTargetVertical );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			} // luminosity high pass material


			if ( THREE.LuminosityHighPassShader === undefined ) console.error( 'THREE.UnrealBloomPass relies on THREE.LuminosityHighPassShader' );
			const highPassShader = THREE.LuminosityHighPassShader;
			this.highPassUniforms = THREE.UniformsUtils.clone( highPassShader.uniforms );
			this.highPassUniforms[ 'luminosityThreshold' ].value = threshold;
			this.highPassUniforms[ 'smoothWidth' ].value = 0.01;
			this.materialHighPassFilter = new THREE.ShaderMaterial( {
				uniforms: this.highPassUniforms,
				vertexShader: highPassShader.vertexShader,
				fragmentShader: highPassShader.fragmentShader,
				defines: {}
			} ); // Gaussian Blur Materials

			this.separableBlurMaterials = [];
			const kernelSizeArray = [ 3, 5, 7, 9, 11 ];
			resx = Math.round( this.resolution.x / 2 );
			resy = Math.round( this.resolution.y / 2 );

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.separableBlurMaterials.push( this.getSeperableBlurMaterial( kernelSizeArray[ i ] ) );
				this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			} // Composite material


			this.compositeMaterial = this.getCompositeMaterial( this.nMips );
			this.compositeMaterial.uniforms[ 'blurTexture1' ].value = this.renderTargetsVertical[ 0 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture2' ].value = this.renderTargetsVertical[ 1 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture3' ].value = this.renderTargetsVertical[ 2 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture4' ].value = this.renderTargetsVertical[ 3 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture5' ].value = this.renderTargetsVertical[ 4 ].texture;
			this.compositeMaterial.uniforms[ 'bloomStrength' ].value = strength;
			this.compositeMaterial.uniforms[ 'bloomRadius' ].value = 0.1;
			this.compositeMaterial.needsUpdate = true;
			const bloomFactors = [ 1.0, 0.8, 0.6, 0.4, 0.2 ];
			this.compositeMaterial.uniforms[ 'bloomFactors' ].value = bloomFactors;
			this.bloomTintColors = [ new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ) ];
			this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors; // copy material

			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.UnrealBloomPass relies on THREE.CopyShader' );

			}

			const copyShader = THREE.CopyShader;
			this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
			this.copyUniforms[ 'opacity' ].value = 1.0;
			this.materialCopy = new THREE.ShaderMaterial( {
				uniforms: this.copyUniforms,
				vertexShader: copyShader.vertexShader,
				fragmentShader: copyShader.fragmentShader,
				blending: THREE.AdditiveBlending,
				depthTest: false,
				depthWrite: false,
				transparent: true
			} );
			this.enabled = true;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();
			this.oldClearAlpha = 1;
			this.basic = new THREE.MeshBasicMaterial();
			this.fsQuad = new THREE.FullScreenQuad( null );

		}

		dispose() {

			for ( let i = 0; i < this.renderTargetsHorizontal.length; i ++ ) {

				this.renderTargetsHorizontal[ i ].dispose();

			}

			for ( let i = 0; i < this.renderTargetsVertical.length; i ++ ) {

				this.renderTargetsVertical[ i ].dispose();

			}

			this.renderTargetBright.dispose();

		}

		setSize( width, height ) {

			let resx = Math.round( width / 2 );
			let resy = Math.round( height / 2 );
			this.renderTargetBright.setSize( resx, resy );

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.renderTargetsHorizontal[ i ].setSize( resx, resy );
				this.renderTargetsVertical[ i ].setSize( resx, resy );
				this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			}

		}

		render( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

			renderer.getClearColor( this._oldClearColor );
			this.oldClearAlpha = renderer.getClearAlpha();
			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			renderer.setClearColor( this.clearColor, 0 );
			if ( maskActive ) renderer.state.buffers.stencil.setTest( false ); // Render input to screen

			if ( this.renderToScreen ) {

				this.fsQuad.material = this.basic;
				this.basic.map = readBuffer.texture;
				renderer.setRenderTarget( null );
				renderer.clear();
				this.fsQuad.render( renderer );

			} // 1. Extract Bright Areas


			this.highPassUniforms[ 'tDiffuse' ].value = readBuffer.texture;
			this.highPassUniforms[ 'luminosityThreshold' ].value = this.threshold;
			this.fsQuad.material = this.materialHighPassFilter;
			renderer.setRenderTarget( this.renderTargetBright );
			renderer.clear();
			this.fsQuad.render( renderer ); // 2. Blur All the mips progressively

			let inputRenderTarget = this.renderTargetBright;

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.fsQuad.material = this.separableBlurMaterials[ i ];
				this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = inputRenderTarget.texture;
				this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPass.BlurDirectionX;
				renderer.setRenderTarget( this.renderTargetsHorizontal[ i ] );
				renderer.clear();
				this.fsQuad.render( renderer );
				this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = this.renderTargetsHorizontal[ i ].texture;
				this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPass.BlurDirectionY;
				renderer.setRenderTarget( this.renderTargetsVertical[ i ] );
				renderer.clear();
				this.fsQuad.render( renderer );
				inputRenderTarget = this.renderTargetsVertical[ i ];

			} // Composite All the mips


			this.fsQuad.material = this.compositeMaterial;
			this.compositeMaterial.uniforms[ 'bloomStrength' ].value = this.strength;
			this.compositeMaterial.uniforms[ 'bloomRadius' ].value = this.radius;
			this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors;
			renderer.setRenderTarget( this.renderTargetsHorizontal[ 0 ] );
			renderer.clear();
			this.fsQuad.render( renderer ); // Blend it additively over the input texture

			this.fsQuad.material = this.materialCopy;
			this.copyUniforms[ 'tDiffuse' ].value = this.renderTargetsHorizontal[ 0 ].texture;
			if ( maskActive ) renderer.state.buffers.stencil.setTest( true );

			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( readBuffer );
				this.fsQuad.render( renderer );

			} // Restore renderer settings


			renderer.setClearColor( this._oldClearColor, this.oldClearAlpha );
			renderer.autoClear = oldAutoClear;

		}

		getSeperableBlurMaterial( kernelRadius ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'KERNEL_RADIUS': kernelRadius,
					'SIGMA': kernelRadius
				},
				uniforms: {
					'colorTexture': {
						value: null
					},
					'texSize': {
						value: new THREE.Vector2( 0.5, 0.5 )
					},
					'direction': {
						value: new THREE.Vector2( 0.5, 0.5 )
					}
				},
				vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 texSize;
				uniform vec2 direction;

				float gaussianPdf(in float x, in float sigma) {
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
				}
				void main() {
					vec2 invSize = 1.0 / texSize;
					float fSigma = float(SIGMA);
					float weightSum = gaussianPdf(0.0, fSigma);
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianPdf(x, fSigma);
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`
			} );

		}

		getCompositeMaterial( nMips ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'NUM_MIPS': nMips
				},
				uniforms: {
					'blurTexture1': {
						value: null
					},
					'blurTexture2': {
						value: null
					},
					'blurTexture3': {
						value: null
					},
					'blurTexture4': {
						value: null
					},
					'blurTexture5': {
						value: null
					},
					'dirtTexture': {
						value: null
					},
					'bloomStrength': {
						value: 1.0
					},
					'bloomFactors': {
						value: null
					},
					'bloomTintColors': {
						value: null
					},
					'bloomRadius': {
						value: 0.0
					}
				},
				vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform sampler2D dirtTexture;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`
			} );

		}

	}

	UnrealBloomPass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
	UnrealBloomPass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

	THREE.UnrealBloomPass = UnrealBloomPass;

} )();

(function(){
"use strict";
/* ================= Q 版屯門：城市生成 ================= */
const C={sky:0xbfe4fb,ground:0xc9d6b8,road:0x5d6470,line:0xffffff,
  amb:0xfdfdfd,red:0xe8323c,hiviz:0xd7ff2e,glass:0x33475b,dark:0x2b2d33,
  jacket:0xff7a1a,reflect:0xe9edf2,navy:0x24324a,skin:0xffd7b5,hair:0x3b2f2a,tree:0x6fcf5a,trunk:0xa9744f};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id);
const R=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
R.setPixelRatio(Math.min(devicePixelRatio,1.3)); R.shadowMap.enabled=true; R.shadowMap.type=THREE.PCFShadowMap;
$('stage').appendChild(R.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color(C.sky); scene.fog=new THREE.Fog(C.sky,200,560);
const cam=new THREE.PerspectiveCamera(55,1,0.5,2400);

const M=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:o.r??0.75,metalness:0,emissive:o.e||0,transparent:!!o.op,opacity:o.op??1});
function add(geo,mat,p,x=0,y=0,z=0,cast=true){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;p.add(m);return m;}
function rbox(w,h,d,r){ r=Math.min(r,w/2-0.01,h/2-0.01,d/2-0.01); if(r<=0.01) return new THREE.BoxGeometry(w,h,d);
  const s=new THREE.Shape(),x=-w/2+r,y=-h/2+r,ww=w-2*r,hh=h-2*r;
  s.moveTo(x,-h/2);s.lineTo(x+ww,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,y);s.lineTo(w/2,y+hh);s.quadraticCurveTo(w/2,h/2,x+ww,h/2);
  s.lineTo(x,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,y+hh);s.lineTo(-w/2,y);s.quadraticCurveTo(-w/2,-h/2,x,-h/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:0,bevelSegments:3,curveSegments:4});
  g.translate(0,0,-(d-2*r)/2); g.computeVertexNormals(); return g; }
const sph=r=>new THREE.SphereGeometry(r,24,16), cyl=(a,b,h,s=20)=>new THREE.CylinderGeometry(a,b,h,s);
function tex(lines,bg,fg,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  if(bg){g.fillStyle=bg;g.fillRect(0,0,w,h)} g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
  lines.forEach((l,i)=>{g.font=l.f;g.fillText(l.t,w/2,h*(i+1)/(lines.length+1))}); const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;}


function drawStar(g,sx,sy,r){
  g.fillStyle='#1f4fbf';
  for(let k=0;k<3;k++){ g.save(); g.translate(sx,sy); g.rotate(k*Math.PI/3); g.fillRect(-r*0.22,-r,r*0.44,r*2); g.restore(); }
  g.strokeStyle='#ffffff'; g.lineWidth=Math.max(2,r*0.07); g.beginPath(); g.moveTo(sx,sy-r*0.75); g.lineTo(sx,sy+r*0.75); g.stroke();
  g.lineWidth=Math.max(2,r*0.05); g.beginPath(); for(let t=0;t<=1.001;t+=0.05){ const yy=sy-r*0.6+t*r*1.2, xx=sx+Math.sin(t*Math.PI*4)*r*0.14; t?g.lineTo(xx,yy):g.moveTo(xx,yy);} g.stroke();
}
const REAR_CACHE={};
function rearTex(body,base='#ffe500'){ const key=base+CALLSIGN+(body?1:0); if(REAR_CACHE[key]) return REAR_CACHE[key]; return REAR_CACHE[key]=rearTex0(body,base); }
function rearTex0(body,base){
  // 車尾整個面（闊 3.0 × 高 3.1）。座標用 600×620，畫喺 2 倍解像度。參考消防處救護車（Design C1）車尾：
  // 下半紅黃倒 V 人字反光、兩邊車柱亦有人字、中間黃底紅字「救 AMBULANCE 護」、兩扇門酒紅圓角窗、車號、KEEP CLEAR
  const S2=2, W=600,H=620,c=document.createElement('canvas'); c.width=W*S2; c.height=H*S2; const g=c.getContext('2d'); g.scale(S2,S2);
  g.fillStyle=base; g.fillRect(0,0,W,H);
  const RED='#e3141f', YEL=base;
  const chev=(x0,y0,x1,y1,apexX,sw)=>{ g.save(); g.beginPath(); g.rect(x0,y0,x1-x0,y1-y0); g.clip(); g.fillStyle=RED;
    for(let o=y0-(x1-x0)-sw*4;o<y1+sw*2;o+=sw*2){ // 由頂點向兩邊斜落嘅紅帶（45°）
      g.beginPath(); g.moveTo(x0,o+(apexX-x0)); g.lineTo(apexX,o); g.lineTo(apexX,o+sw*1.414); g.lineTo(x0,o+(apexX-x0)+sw*1.414); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x1,o+(x1-apexX)); g.lineTo(apexX,o); g.lineTo(apexX,o+sw*1.414); g.lineTo(x1,o+(x1-apexX)+sw*1.414); g.closePath(); g.fill(); }
    g.restore(); };
  // 下半人字（窗以下成個車尾）＋兩邊車柱人字（由頂到底）
  chev(0,352,W,H,W/2,24); chev(0,150,60,352,0,20); chev(W-60,150,W,352,W,20);
  // 「救 AMBULANCE 護」黃底橫帶
  g.fillStyle=YEL; g.fillRect(0,288,W,64); g.fillStyle=RED; g.fillRect(0,286,W,3); g.fillRect(0,351,W,3);
  g.textAlign='center'; g.textBaseline='middle'; g.fillStyle=RED;
  g.font='900 46px sans-serif'; g.fillText('救',34,321); g.fillText('護',W-34,321);
  g.font='900 56px "Arial Black",Arial,sans-serif'; g.fillText('AMBULANCE',W/2,322);
  // 兩邊車柱頂：生命之星同直排細字
  drawStar(g,30,36,22); drawStar(g,W-30,36,22);
  g.font='bold 19px sans-serif'; ['救','護','車'].forEach((ch,i)=>g.fillText(ch,30,76+i*22)); ['勿','駛','近'].forEach((ch,i)=>g.fillText(ch,W-30,76+i*22));
  // 兩扇門：酒紅色圓角長窗、反光、黑色膠邊
  const rr=(x,y,w,h,r)=>{ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); };
  const win=(x)=>{ const w=96,h=190,y=58,r=46; rr(x-w/2-5,y-5,w+10,h+10,r+5); g.fillStyle='#1d1f24'; g.fill();
    const gr=g.createLinearGradient(0,y,0,y+h); gr.addColorStop(0,'#8a3a48'); gr.addColorStop(1,'#4a1720'); rr(x-w/2,y,w,h,r); g.fillStyle=gr; g.fill();
    g.fillStyle='rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(x-w/2+12,y+40); g.lineTo(x-w/2+36,y+24); g.lineTo(x-w/2+36,y+h-50); g.lineTo(x-w/2+12,y+h-34); g.fill(); };
  win(180); win(420);
  g.fillStyle=RED; g.font='bold 24px sans-serif'; g.fillText(CALLSIGN,180,272); g.fillText(CALLSIGN,420,272);
  // KEEP CLEAR 黃底框
  g.fillStyle=YEL; g.fillRect(118,430,364,70); g.strokeStyle=RED; g.lineWidth=4; g.strokeRect(118,430,364,70);
  g.fillStyle=RED; g.font='900 52px "Arial Black",Arial,sans-serif'; g.fillText('KEEP CLEAR',W/2,467);
  // 門縫、鉸、門把、底部踏板
  g.strokeStyle='rgba(60,50,0,.55)'; g.lineWidth=3; g.strokeRect(60,40,480,540); g.beginPath(); g.moveTo(W/2,40); g.lineTo(W/2,580); g.stroke();
  g.fillStyle='#3a3d44'; [[62,90],[62,290],[62,500],[W-70,90],[W-70,290],[W-70,500]].forEach(([x,y])=>g.fillRect(x,y,8,34));
  g.fillStyle='#8d939c'; g.fillRect(W/2-36,374,22,48); g.fillRect(W/2+14,374,22,48); g.fillStyle='#5d636c'; g.fillRect(W/2-33,380,16,6); g.fillRect(W/2+17,380,16,6);
  g.fillStyle='#24262b'; g.fillRect(0,586,W,34); g.fillStyle='#3a3d44'; for(let x=10;x<W;x+=24) g.fillRect(x,590,14,4);
  if(body){ g.fillStyle='#4a5260'; g.fillRect(60,40,480,540); g.fillStyle='#d9dde3'; g.fillRect(80,470,440,90); g.fillStyle='#6f7884'; g.fillRect(80,60,440,30);
    g.fillStyle='#c94a4a'; g.fillRect(260,300,80,150); g.fillStyle='#e6e9ee'; g.fillRect(110,120,120,300); g.fillRect(370,120,120,300); }
  return c;
}
function roofTex(base='#ffe500'){
  // 車頂（闊 2.7 × 長 4.9）：canvas 上方 = 車頭
  const W=270,H=490,c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,W,H);
  // 邊緣紅藍線（跟車身斜紋延續）
  g.fillStyle='#e8202a'; g.fillRect(6,0,12,H); g.fillStyle='#1f4fbf'; g.fillRect(W-18,0,12,H);
  g.fillStyle='#1f4fbf'; g.fillRect(6,H-20,W-12,8); g.fillStyle='#e8202a'; g.fillRect(6,H-34,W-12,8);
  // 大生命之星（近車尾）
  drawStar(g,W/2,H-100,70);
  // 大車號（沿車身長度）
  g.save(); g.translate(W/2,H*0.44); g.rotate(Math.PI/2); g.fillStyle='#1f4fbf'; g.font='bold 92px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(CALLSIGN,0,0); g.restore();
  const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t;
}
function liveryTex(frontRight,classic){
  // 車身側面貼紙：紅藍斜紋、生命之星、文字。長 7.05 × 高 3.1（每單位 160px）
  const PX=160, W=Math.round(7.05*PX), H=Math.round(3.1*PX);
  const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
  const X=x=>frontRight?x:W-x;
  const band=(pts,col,wd)=>{ g.strokeStyle=col; g.lineWidth=wd; g.lineJoin='round'; g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(X(x),y):g.moveTo(X(x),y)); g.stroke(); };
  if(classic){ // 經典白色：紅黃紅斜紋由車頭低位斜上車尾
    const P=(dy)=>[[W+10,404+dy],[720,404+dy],[470,190+dy],[-10,190+dy]];
    band(P(0),'#e8202a',46); band(P(-44),'#ffd400',40); band(P(-84),'#e8202a',34);
    drawStar(g,X(215),350,84);
    g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#1f4fbf';
    g.font='bold 46px sans-serif'; g.fillText('AMBULANCE',X(520),458); g.font='bold 40px sans-serif'; g.fillText('救護',X(820),300);
    g.font='bold 40px sans-serif'; g.fillText(CALLSIGN,X(800),110);
    g.fillStyle='#3c4656'; g.fillRect(frontRight?640:W-640-80,70,80,70);
    g.strokeStyle='rgba(120,120,120,.6)'; g.lineWidth=4; g.strokeRect(frontRight?620:W-620-110,170,110,230);
    const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t; }
  // 紅帶（上）同藍帶（下），喺側門前斜落車頭
  band([[150,218],[620,218],[770,330],[W+10,330]],'#e8202a',34);
  band([[150,270],[600,270],[740,374],[W+10,374]],'#1f4fbf',34);
  band([[150,244],[610,244],[755,352],[W+10,352]],'#ffd400',10);
  drawStar(g,X(118),230,100);
  // 文字
  g.textAlign='center'; g.textBaseline='middle';
  g.fillStyle='#1c1c1c'; g.font='bold 30px sans-serif'; g.fillText('消防處救護車',X(470),219);
  g.fillStyle='#ffffff'; g.font='bold 20px sans-serif'; g.fillText('FIRE SERVICES AMBULANCE',X(420),271);
  g.fillStyle='#e8202a'; g.font='bold 40px sans-serif'; g.fillText('AMBULANCE',X(420),330); g.font='bold 44px sans-serif'; g.fillText('救護',X(420),382);
  g.fillStyle='#1f4fbf'; g.font='bold 40px sans-serif'; g.fillText(CALLSIGN,X(780),110);
  // 車廂小窗
  g.fillStyle='#3c4656'; g.fillRect(frontRight?640:W-640-80,70,80,70);
  // 側門輪廓
  g.strokeStyle='rgba(120,120,90,.7)'; g.lineWidth=4; g.strokeRect(frontRight?620:W-620-110,170,110,230);
  const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t;
}
let CALLSIGN='A188';
function ambulance(num){ CALLSIGN=num||'A188';
  const g=new THREE.Group(); scene.add(g);
  const body=new THREE.Group(); g.add(body); // 車頭 = +z
  const Y=M(0xffe500,{r:0.45,e:0x3a3300}), gl=M(C.glass,{r:0.15}), dk=M(C.dark), red=M(C.red), grey=M(0xb8bcc2);
  add(rbox(3.0,3.1,5.4,0.4),Y,body,0,2.15,-0.7);              // 車廂（方箱）
  add(rbox(2.85,2.5,0.9,0.35),Y,body,0,1.85,2.45);            // 駕駛室
  add(rbox(2.85,1.35,0.9,0.35),Y,body,0,1.28,3.2);            // 車頭（較矮）
  const ws=add(new THREE.BoxGeometry(2.45,1.0,0.08),gl,body,0,2.55,2.95,false); ws.rotation.x=-0.45;
  add(rbox(2.95,0.45,0.35,0.15),dk,body,0,0.8,3.62);          // 黑色前泵把
  add(rbox(3.02,0.5,0.6,0.15),dk,body,0,0.85,-3.4);           // 後泵把
  [-0.95,0.95].forEach(x=>add(sph(0.2),M(0xfff6c4,{e:0x554400}),body,x,1.55,3.65,false));
  // 車頭紅藍帶、引擎蓋生命之星、車廂頂「AMBULANCE」藍牌
  add(new THREE.BoxGeometry(2.7,0.12,0.04),M(0xe8202a),body,0,1.93,3.66,false);
  add(new THREE.BoxGeometry(2.7,0.12,0.04),M(0x1f4fbf),body,0,1.8,3.66,false);
  { const c=document.createElement('canvas'); c.width=128; c.height=128; const g2=c.getContext('2d'); drawStar(g2,64,64,56);
    const st=new THREE.Mesh(new THREE.PlaneGeometry(0.55,0.55),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true}));
    st.rotation.x=-Math.PI/2; st.position.set(0,1.97,3.25); body.add(st); }
  { const c=document.createElement('canvas'); c.width=512; c.height=96; const g2=c.getContext('2d');
    g2.fillStyle='#1f4fbf'; g2.fillRect(0,0,512,96); g2.strokeStyle='#ffffff'; g2.lineWidth=6; g2.strokeRect(8,8,496,80);
    g2.fillStyle='#ffffff'; g2.font='bold 62px sans-serif'; g2.textAlign='center'; g2.textBaseline='middle'; g2.fillText('AMBULANCE',256,50);
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(2.0,0.38),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));
    sg.position.set(0,3.42,2.03); body.add(sg); }
  const SK={sides:[],doors:[]}; const myNum=CALLSIGN;
  { const rf=SK.roof=new THREE.Mesh(new THREE.PlaneGeometry(2.7,4.9),new THREE.MeshStandardMaterial({map:roofTex(),roughness:0.5}));
    rf.rotation.x=-Math.PI/2; rf.rotation.z=Math.PI; rf.position.set(0,3.71,-0.7); body.add(rf); }
  [-1,1].forEach(sx=>{
    add(rbox(0.12,0.45,0.25,0.05),dk,body,sx*1.62,2.35,2.95,false); add(new THREE.BoxGeometry(0.25,0.05,0.05),dk,body,sx*1.52,2.35,2.95,false);
    add(new THREE.BoxGeometry(0.05,0.8,0.75),gl,body,sx*1.44,2.4,2.5,false);           // 側窗
    const p=new THREE.Mesh(new THREE.PlaneGeometry(7.05,3.1),new THREE.MeshStandardMaterial({map:liveryTex(sx<0),transparent:true,roughness:0.5}));
    p.position.set(sx*1.53,2.15,0.125); p.rotation.y=sx*Math.PI/2; body.add(p); SK.sides.push([p,sx<0]);
  });
  // 藍色警示燈：車頂四角 + 前燈架
  const blues=[];
  [[-1.2,3.75,-3.2],[1.2,3.75,-3.2],[-1.2,3.75,1.7],[1.2,3.75,1.7]].forEach(([x,y,z],i)=>blues.push(add(rbox(0.5,0.18,0.3,0.06),M(0x2f6bff),body,x,y,z,false)));
  blues.push(add(rbox(0.32,0.3,0.12,0.05),M(0x2f6bff),body,-1.25,3.42,2.04,false), add(rbox(0.32,0.3,0.12,0.05),M(0x2f6bff),body,1.25,3.42,2.04,false));
  const pB=new THREE.PointLight(0x3a88ff,0,11), pR=new THREE.PointLight(0x3a88ff,0,11); pB.position.set(-1,4.2,0); pR.position.set(1,4.2,0); body.add(pB,pR);
  // 車輪
  const wheels=[]; [[-1.42,2.6],[1.42,2.6],[-1.42,-2.3],[1.42,-2.3]].forEach(([x,z])=>{
    const w=add(cyl(0.6,0.6,0.48),dk,body,x,0.6,z); w.rotation.z=Math.PI/2; add(cyl(0.3,0.3,0.5),grey,w,0,0,0,false); wheels.push(w);});
  // 尾門 + 紅黃人字反光
  const REAR=rearTex(false), REARB=rearTex(true);
  { const bp=SK.bp=new THREE.Mesh(new THREE.PlaneGeometry(3.0,3.1),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(REARB),roughness:0.5}));
    bp.rotation.y=Math.PI; bp.position.set(0,2.15,-3.405); body.add(bp); }
  const doors=[]; [-1,1].forEach(s=>{ const hinge=new THREE.Group(); hinge.position.set(s*1.2,0,-3.43); body.add(hinge);
    const d=add(new THREE.BoxGeometry(1.2,2.7,0.06),Y,hinge,-s*0.6,2.15,0);
    const tx=new THREE.CanvasTexture(REAR); tx.anisotropy=8; tx.repeat.set(0.4,540/620); tx.offset.set(s>0?0.1:0.5,40/620);
    const dp=new THREE.Mesh(new THREE.PlaneGeometry(1.2,2.7),new THREE.MeshStandardMaterial({map:tx,roughness:0.5})); dp.rotation.y=Math.PI; dp.position.z=-0.035; d.add(dp); SK.doors.push([dp,s]);
    hinge.userData.s=s; doors.push(hinge); });
  // 尾燈（紅＋琥珀，直排）、車牌、踏板
  const LT={tail:[],ind:{}};
  [-1,1].forEach(s=>{ LT.tail.push(add(rbox(0.22,0.34,0.1,0.04),M(0xe8202a,{e:0x400000}),body,s*1.36,1.32,-3.43,false));
    LT.ind[s]=[add(rbox(0.22,0.2,0.1,0.04),M(0xffa31a,{e:0x402000}),body,s*1.36,1.02,-3.43,false)];
    add(rbox(0.22,0.14,0.1,0.04),M(0xffffff),body,s*1.36,0.82,-3.43,false); });
  { const c=document.createElement('canvas'); c.width=256; c.height=64; const g2=c.getContext('2d'); g2.fillStyle='#ffd400'; g2.fillRect(0,0,256,64); g2.strokeStyle='#111'; g2.lineWidth=4; g2.strokeRect(3,3,250,58);
    g2.fillStyle='#111'; g2.font='bold 44px sans-serif'; g2.textAlign='center'; g2.textBaseline='middle'; g2.fillText(CALLSIGN,128,34);
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.23),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)})); pl.rotation.y=Math.PI; pl.position.set(0,0.85,-3.72); body.add(pl); }
  add(new THREE.BoxGeometry(1.6,0.08,0.35),M(0x8a8f97),body,0,0.62,-3.75,false);
  // 車頂設備：冷氣機、天窗、天線、尾部藍燈
  add(rbox(1.3,0.26,0.6,0.1),M(0xe9ecef),body,0,3.83,1.4);
  add(cyl(0.03,0.03,0.7,6),M(0x2b2d33),body,0.9,4.05,1.6,false);
  add(cyl(0.03,0.03,0.5,6),M(0x2b2d33),body,-0.9,3.95,-2.6,false);
  blues.push(add(rbox(0.4,0.18,0.18,0.05),M(0x2f6bff),body,-0.9,3.55,-3.47,false), add(rbox(0.4,0.18,0.18,0.05),M(0x2f6bff),body,0.9,3.55,-3.47,false));
  add(rbox(0.3,0.16,0.16,0.05),M(0xffa31a,{e:0x402000}),body,0,3.6,-3.47,false);
  // 換塗裝（黃／經典白）：第一次用先生成貼圖
  const TS={}; const texSet=(cl)=>{ if(TS[cl]) return TS[cl]; CALLSIGN=myNum; const base=cl?'#f4f6f8':'#ffe500';
    const R=rearTex(false,base), RB=rearTex(true,base);
    const dt=s=>{ const tx=new THREE.CanvasTexture(R); tx.anisotropy=8; tx.repeat.set(0.4,540/620); tx.offset.set(s>0?0.1:0.5,40/620); return tx; };
    return TS[cl]={roof:roofTex(base),bp:new THREE.CanvasTexture(RB),side:{true:liveryTex(true,cl),false:liveryTex(false,cl)},door:{'1':dt(1),'-1':dt(-1)}}; };
  const setClassic=(cl)=>{ cl=!!cl; if(!cl&&!TS[true]&&!TS[false]) return; const T=texSet(cl); const put=(mesh,t)=>{ mesh.material.map=t; mesh.material.needsUpdate=true; };
    put(SK.roof,T.roof); put(SK.bp,T.bp); SK.sides.forEach(([p,f])=>put(p,T.side[f])); SK.doors.forEach(([p,s])=>put(p,T.door[s])); };
  // 夜間照明射燈：車尾同左右兩邊車頂附近（白色），地面有柔和光
  const FL={lamps:[],glow:[]};
  { const lm=M(0xf4f6f8,{e:0}); [[-1.25,3.32,-3.47,0],[1.25,3.32,-3.47,0],[1.52,3.32,-2.2,1],[1.52,3.32,0.4,1],[-1.52,3.32,-2.2,1],[-1.52,3.32,0.4,1]].forEach(([x,y,z,sd])=>{ const b=add(rbox(sd?0.08:0.34,0.16,sd?0.34:0.08,0.03),lm,body,x,y,z,false); FL.lamps.push(b); }); FL.mat=lm;
    const c=document.createElement('canvas'); c.width=c.height=128; const g2=c.getContext('2d'); const rg=g2.createRadialGradient(64,64,4,64,64,64); rg.addColorStop(0,'rgba(255,255,255,.85)'); rg.addColorStop(0.5,'rgba(255,255,255,.3)'); rg.addColorStop(1,'rgba(255,255,255,0)'); g2.fillStyle=rg; g2.fillRect(0,0,128,128);
    const gm=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,color:0xf2f6ff,opacity:0.38,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5}); FL.gmat=gm;
    [[0,-7.2,8,7],[5.4,-0.8,6,10],[-5.4,-0.8,6,10]].forEach(([x,z,w,l])=>{ const q=new THREE.Mesh(new THREE.PlaneGeometry(w,l),gm); q.rotation.x=-Math.PI/2; q.position.set(x,0.3,z); q.renderOrder=3; q.visible=false; body.add(q); FL.glow.push(q); }); }
  // 車頭轉向燈（前角）
  [-1,1].forEach(s=>LT.ind[s].push(add(rbox(0.16,0.14,0.12,0.03),M(0xffa31a,{e:0x402000}),body,s*1.25,1.32,3.62,false)));
  g.userData={body,doors,wheels,blues,pB,pR,lb:blues[4],lr:blues[5],setClassic,LT,FL};
  return g;
}
/* ---------- Q 版救護員（橙色風褸） ---------- */
function person(kind){
  const g=new THREE.Group();
  const jacket=kind==='crew'?M(C.jacket):M(kind==='bystander'?0x7ec8e3:0xa78bfa), refl=M(C.reflect,{e:0x333333,r:0.3}), legs=M(kind==='crew'?C.navy:0x50586a);
  add(cyl(0.45,0.52,1.05),jacket,g,0,1.07,0);
  if(kind==='crew'){ add(cyl(0.465,0.49,0.1),refl,g,0,0.9,0,false); add(cyl(0.455,0.475,0.1),refl,g,0,1.25,0,false); add(cyl(0.2,0.2,0.18),jacket,g,0,1.62,0); }
  add(sph(0.64),M(C.skin),g,0,2.1,0);
  const hair=add(sph(0.67),M(C.hair),g,0,2.24,-0.07); hair.scale.set(1,0.86,1);   // 頭髮要高過個頭頂（2.74），唔係會露出膚色似禿頭
  if(kind==='crew'){ // 藍色 cap 帽：帽頂＋帽舌
    const capM=M(0x1f4fbf,{r:0.6}); const top=add(new THREE.SphereGeometry(0.71,20,10,0,Math.PI*2,0,Math.PI/2),capM,g,0,2.3,-0.04); top.scale.set(1,0.82,1);   // 帽頂約 2.88，蓋過頭頂
    add(new THREE.CylinderGeometry(0.7,0.7,0.1,20),capM,g,0,2.31,-0.04);
    const brim=add(new THREE.CylinderGeometry(0.42,0.42,0.06,16,1,false,-Math.PI/2,Math.PI),M(0x183f99,{r:0.6}),g,0,2.36,0.4,false); brim.scale.set(1.1,1,0.8); }
  [-0.21,0.21].forEach(x=>add(sph(0.08),M(0x22252b),g,x,2.15,0.58,false));
  [-0.34,0.34].forEach(x=>add(sph(0.085),M(0xff9aa2),g,x,1.99,0.52,false));
  const arms=[-0.6,0.6].map(x=>{const a=add(cyl(0.13,0.13,0.8),jacket,g,x,1.18,0.12); if(kind==='crew') add(cyl(0.14,0.14,0.08),refl,a,0,-0.15,0,false); a.rotation.x=-0.8; return a;});
  const legL=add(cyl(0.15,0.15,0.6),legs,g,-0.21,0.3,0), legR=add(cyl(0.15,0.15,0.6),legs,g,0.21,0.3,0);
  [legL,legR].forEach(l=>add(sph(0.17),M(0x1f2328),l,0,-0.3,0.06,false));
  g.userData={legL,legR,arms}; return g;
}
function stretcherSet(){
  const g=new THREE.Group(); scene.add(g);
  const st=new THREE.Group(); g.add(st);
  const fr=M(0xc9d1da), mat=M(0xff9f1c), dk=M(C.dark);
  add(rbox(1.2,0.16,3.2,0.07),fr,st,0,1.0,0); add(rbox(1.1,0.22,3.0,0.1),mat,st,0,1.18,0);
  [[-0.45,1.2],[0.45,1.2],[-0.45,-1.2],[0.45,-1.2]].forEach(([x,z])=>{add(cyl(0.05,0.05,0.9),fr,st,x,0.5,z);add(sph(0.14),dk,st,x,0.12,z);});
  const c1=person('crew'), c2=person('crew'); c1.position.z=2.3; c1.rotation.y=Math.PI; c2.position.z=-2.3; g.add(c1,c2);
  g.userData={st,c1,c2}; g.visible=false; return g;
}
function lyingPatient(){
  const g=new THREE.Group(); scene.add(g);
  const p=person('patient'); p.rotation.x=-Math.PI/2; p.position.set(0,0.5,1.2); g.add(p);
  const blanket=add(rbox(1.1,0.35,1.9,0.15),M(0xb9e3ff),g,0,0.62,0.4); blanket.visible=false; g.userData={blanket,p}; return g;
}



let seed=20261108; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647; const pick=a=>a[rnd()*a.length|0];

/* ---------- 貼圖 ---------- */
function canvasTex(w,h,draw,rep=true){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;} t.anisotropy=4; return t; }
const rr=(g,x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
// 屋邨：一格 = 一層兩個單位（闊 8 米、高 3 米）
function housingTex(wall,trim,k0=0){ return canvasTex(256,96,(g,w,h)=>{
  g.fillStyle=wall; g.fillRect(0,0,w,h); g.fillStyle=trim; g.fillRect(0,h-8,w,8);
  for(let k=0;k<2;k++){ const x=k*128+22;
    g.fillStyle='#ffffff'; rr(g,x-4,16,88,52,8); g.fill();
    g.fillStyle=['#7fb3d5','#9cc9e6','#ffe6a3','#8fc1e3'][(k+k0)%4]; rr(g,x,20,80,44,6); g.fill();
    g.fillStyle='rgba(255,255,255,.55)'; g.fillRect(x+38,20,4,44);
    if(k===0){ g.fillStyle='#d9dde3'; rr(g,x+58,70,26,16,3); g.fill(); g.fillStyle='#aeb5bf'; g.fillRect(x+62,74,18,2); g.fillRect(x+62,79,18,2);} // 冷氣機
  } }); }
// 唐樓：露台、晾衫
function tongTex(wall,k0){ return canvasTex(256,96,(g,w,h)=>{
  g.fillStyle=wall; g.fillRect(0,0,w,h);
  for(let k=0;k<3;k++){ const x=k*85+10; g.fillStyle='#5b6b7d'; g.fillRect(x,18,62,46); g.fillStyle='#a8c6dc'; g.fillRect(x+4,22,54,38);
    g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x+29,22,3,38); g.fillStyle='#e9e2d4'; g.fillRect(x-4,64,70,6);
    if((k+k0)%2){ ['#ff8fab','#8fd3ff','#ffd166','#b8f2a8'].forEach((c,q)=>{g.fillStyle=c; g.fillRect(x+6+q*14,66,8,14);}); } }
  g.fillStyle='rgba(0,0,0,.12)'; g.fillRect(0,h-4,w,4); }); }
// 地舖：一格 = 4 間舖（闊 24 米、高 4.5 米）
const SHOPS=['茶餐廳','藥房','麵包店','便利店','涼茶','文具','時裝','眼鏡','五金','海味','燒味','髮型屋','電器','車仔麵','金行','花店','書局','糖水','士多','雜貨'];
const SCOL=['#e63946','#2a9d8f','#f4a261','#457b9d','#e76f51','#6a4c93','#2b9348','#d62828','#0077b6','#ff006e'];
function shopTex(){ return canvasTex(512,96,(g,w,h)=>{
  g.fillStyle='#f3efe6'; g.fillRect(0,0,w,h);
  for(let k=0;k<4;k++){ const x=k*128; const col=pick(SCOL);
    g.fillStyle=col; g.fillRect(x+4,4,120,26); g.fillStyle='#fff'; g.font='bold 20px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(pick(SHOPS),x+64,18);
    for(let s=0;s<8;s++){ g.fillStyle=s%2?'#ffffff':col; g.fillRect(x+4+s*15,32,15,10); } // 雨篷
    if(rnd()<0.75){ g.fillStyle='#bfe3f2'; g.fillRect(x+12,44,104,46); g.fillStyle='rgba(255,255,255,.6)'; g.fillRect(x+20,48,8,38);
      g.fillStyle=pick(['#ffd166','#ff8fab','#8ecae6','#cdb4db']); g.fillRect(x+36,70,30,20); g.fillRect(x+74,64,26,26); }
    else { g.fillStyle='#b8bec6'; g.fillRect(x+12,44,104,46); g.fillStyle='#9aa1aa'; for(let q=0;q<10;q++) g.fillRect(x+12,46+q*4.6,104,1.5); } // 閘
  } }); }
const MAT={}; function texMat(key,tex){ if(!MAT[key]) MAT[key]=new THREE.MeshStandardMaterial({map:tex,roughness:0.8}); return MAT[key]; }
const HOUSING=[['#ffd6e0','#ff8fab'],['#d3f5e8','#52b788'],['#d8ecff','#5aa9e6'],['#fff2c6','#f4a261'],['#eadcff','#9d4edd'],['#ffe5d1','#f77f00']];
const housingMats=HOUSING.map((p,k)=>texMat('h'+k,housingTex(p[0],p[1],k)));
const tongMats=['#f2e3c9','#e8d5d5','#d9e4d0','#f0d9b5'].map((c,k)=>texMat('t'+k,tongTex(c,k)));
const shopMats=[0,1,2,3,4,5].map(k=>texMat('s'+k,shopTex()));
const roofMat=new THREE.MeshStandardMaterial({color:0xa9b0ba,roughness:0.9});
// 天台：有地磚格、矮牆、通風口，幾種顏色
const roofMats=[['#c9b8a6','#a8947f'],['#b9c6cf','#8fa2b0'],['#c7d1b3','#9fae86'],['#d8c3c3','#b39494'],['#cfc6e0','#a49abf']].map(([a,b],k)=>texMat('roof'+k,canvasTex(128,128,(g,w,h)=>{
  g.fillStyle=a; g.fillRect(0,0,w,h); g.strokeStyle=b; g.lineWidth=2; for(let q=0;q<=w;q+=16){ g.beginPath(); g.moveTo(q,0); g.lineTo(q,h); g.stroke(); g.beginPath(); g.moveTo(0,q); g.lineTo(w,q); g.stroke(); }
  g.fillStyle='rgba(255,255,255,.55)'; g.fillRect(20+k*8,30,22,22); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(80,76-k*6,18,30); })));
const walkTex=canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#c9c0b0'; g.fillRect(0,0,w,h); g.strokeStyle='#a99c86'; g.lineWidth=2; g.strokeRect(1,1,31,31); g.strokeRect(33,1,30,31); g.strokeRect(1,33,31,30); g.strokeRect(33,33,30,30); g.fillStyle='#bdb19c'; g.fillRect(34,34,28,28); });
const walkMat=new THREE.MeshStandardMaterial({map:walkTex,roughness:0.9}), lotMat=M(0xcfc3ab,{r:0.95}), grassMat=M(0x78c255,{r:0.95}), podMat=M(0x82c766,{r:0.95}), alleyMat=M(0xbcb6a8,{r:0.95});

/* ---------- 畫面質素（0 標準、1 精細、2 超精細）：要重新載入地圖先生效 ---------- */
const GFX=(()=>{ try{ const v=+JSON.parse(localStorage.getItem('a188.gfx')||'2'); return v>=2?2:v>=1?1:0; }catch(e){ return 0; } })();
// 細節專用亂數（唔郁到城市本身嘅 rnd，所以三個模式嘅街道同樓宇位置一樣）
let _ds=7919; const drnd=()=>{ _ds=(_ds*1664525+1013904223)>>>0; return _ds/4294967296; }; const dpick=a=>a[drnd()*a.length|0];
const DFRONT=[]; window.__DF=DFRONT;   // 沿街樓宇門面：{c,type,h}
/* ----- 精細模式：更多款舖頭門面（自創舖名，唔用真實品牌） ----- */
if(GFX){
  const PRE=['新記','合興','永利','祥興','華豐','大華','好運','鴻運','金城','百樂','東興','福來','利源','裕泰','恆昌','德記','發記','明記','寶華','美華'];
  const KINDS=[
    ['茶餐廳','food','#1f7a4d'],['冰室','food','#2a9d8f'],['粥麵','food','#c1121f'],['車仔麵','food','#e85d04'],['糖水','food','#c9184a'],
    ['燒味','roast','#b5179e'],['燒臘飯店','roast','#9d0208'],
    ['大藥房','pharm','#0077b6'],['便利店','pharm','#2b9348'],['士多','pharm','#e76f51'],['文具','pharm','#6a4c93'],
    ['金行','gold','#b8860b'],['珠寶','gold','#9d0208'],['錶行','gold','#3a0ca3'],
    ['地產','estate','#1d4e89'],['找換','estate','#386641'],
    ['生果','fruit','#e85d04'],['海味','fruit','#7f4f24'],['花店','fruit','#d81159'],
    ['五金','hw','#495057'],['電器','hw','#023e8a'],['眼鏡','hw','#0081a7'],
    ['髮型屋','barber','#ef476f'],['涼茶','food','#432818'],['中醫','pharm','#6b4226'],['麵包西餅','food','#bc6c25']];
  const font=(g,t,w,px)=>{ let s=px; g.font='bold '+s+'px sans-serif'; while(g.measureText(t).width>w&&s>12){ s-=2; g.font='bold '+s+'px sans-serif'; } };
  function front(g,x,W,H,kind){ const [nm,tp,col]=kind, name=dpick(PRE)+nm;
    // 招牌（成條，凸邊）
    g.fillStyle='#2b2b2b'; g.fillRect(x+2,2,W-4,52); g.fillStyle=col; g.fillRect(x+5,5,W-10,46);
    g.fillStyle='rgba(255,255,255,.18)'; g.fillRect(x+5,5,W-10,8);
    g.fillStyle=tp==='gold'?'#ffe066':'#ffffff'; g.textAlign='center'; g.textBaseline='middle'; font(g,name,W-24,34); g.fillText(name,x+W/2,30);
    // 柱同門框
    g.fillStyle='#d8d2c4'; g.fillRect(x,56,8,H-56); g.fillRect(x+W-8,56,8,H-56);
    const fx=x+10, fy=60, fw=W-20, fh=H-62;
    if(drnd()<0.12){ // 落咗閘
      g.fillStyle='#aab1ba'; g.fillRect(fx,fy,fw,fh); g.fillStyle='#8d949d'; for(let q=0;q<fh;q+=6) g.fillRect(fx,fy+q,fw,2); return; }
    const glass=(c)=>{ g.fillStyle=c; g.fillRect(fx,fy,fw,fh); };
    if(tp==='food'){ glass('#ffe9c2'); g.fillStyle='#c8553d'; for(let k=0;k<4;k++) g.fillRect(fx+8+k*(fw-16)/4,fy+8,(fw-16)/4-8,26);   // 牆上餐牌
      g.fillStyle='#fff'; for(let k=0;k<4;k++) for(let l=0;l<3;l++) g.fillRect(fx+12+k*(fw-16)/4,fy+12+l*7,(fw-16)/4-16,3);
      g.fillStyle='#6b4f3a'; for(let k=0;k<3;k++){ const tx=fx+20+k*(fw-40)/3; g.fillRect(tx,fy+fh-42,40,6); g.fillRect(tx+18,fy+fh-36,4,30); }
      g.fillStyle='#ffd166'; for(let k=0;k<3;k++){ g.beginPath(); g.arc(fx+40+k*(fw-60)/3,fy+44,7,0,6.3); g.fill(); } }
    else if(tp==='roast'){ glass('#ffd7a8'); g.fillStyle='#8a4b2a'; g.fillRect(fx,fy+8,fw,4);
      for(let k=0;k<6;k++){ const hx=fx+16+k*(fw-30)/6; g.fillStyle='#a0522d'; g.beginPath(); g.ellipse(hx+10,fy+40,11,22,0,0,6.3); g.fill(); g.fillStyle='#d2691e'; g.beginPath(); g.ellipse(hx+8,fy+36,6,12,0,0,6.3); g.fill(); g.fillStyle='#555'; g.fillRect(hx+9,fy+10,2,10); }
      g.fillStyle='#c0392b'; g.fillRect(fx,fy+fh-30,fw,30); g.fillStyle='#e9e9e9'; g.fillRect(fx+6,fy+fh-24,fw-12,6); }
    else if(tp==='pharm'){ glass('#f4fbff'); const cs=['#e63946','#2a9d8f','#ffb703','#457b9d','#f72585','#06d6a0','#8338ec'];
      for(let r=0;r<5;r++) for(let k=0;k<fw/12-1;k++){ g.fillStyle=cs[(r*3+k)%cs.length]; g.fillRect(fx+6+k*12,fy+8+r*22,9,14); }
      g.fillStyle='#cfd8dc'; for(let r=0;r<5;r++) g.fillRect(fx+4,fy+23+r*22,fw-8,2);
      if(kind[0].includes('藥')){ g.fillStyle='#e63946'; g.fillRect(fx+fw-34,fy+6,24,8); g.fillRect(fx+fw-26,fy-2,8,24); } }
    else if(tp==='gold'){ glass('#7a0b0b'); g.fillStyle='#ffd166'; for(let k=0;k<3;k++){ g.fillRect(fx+10+k*(fw-20)/3,fy+fh-46,(fw-20)/3-10,40); }
      g.fillStyle='#fff3b0'; for(let q=0;q<26;q++){ g.beginPath(); g.arc(fx+10+drnd()*(fw-20),fy+fh-40+drnd()*30,2.5,0,6.3); g.fill(); }
      g.fillStyle='#ffe066'; font(g,'足金',fw/2,30); g.fillText('足金',fx+fw/2,fy+28); }
    else if(tp==='estate'){ glass('#dbe9f6'); g.fillStyle='#fff'; for(let r=0;r<4;r++) for(let k=0;k<fw/30;k++){ g.fillRect(fx+6+k*30,fy+6+r*30,24,26); g.fillStyle='#e63946'; g.fillRect(fx+8+k*30,fy+9+r*30,14,4); g.fillStyle='#fff'; } }
    else if(tp==='fruit'){ glass('#5a4636'); const cs=nm==='海味'?['#c68b59','#8d5524','#e0a96d','#a0522d']:nm==='花店'?['#ff4d6d','#ffd60a','#c77dff','#ff8fab']:['#ff7b00','#e5383b','#ffd000','#70e000','#9d4edd'];
      for(let r=0;r<3;r++){ g.fillStyle='#8d6e4c'; g.fillRect(fx+4,fy+fh-24-r*28,fw-8,6); for(let k=0;k<fw/9-1;k++){ g.fillStyle=cs[(k+r)%cs.length]; g.beginPath(); g.arc(fx+10+k*9,fy+fh-30-r*28,4.5,0,6.3); g.fill(); } } }
    else if(tp==='hw'){ glass('#e9ecef'); for(let k=0;k<fw/28;k++){ g.fillStyle=nm==='電器'?'#222':'#6c757d'; g.fillRect(fx+6+k*28,fy+10,22,nm==='電器'?16:30); if(nm==='電器'){ g.fillStyle=dpick(['#4cc9f0','#f72585','#b5e48c']); g.fillRect(fx+8+k*28,fy+12,18,12); } }
      g.fillStyle='#adb5bd'; g.fillRect(fx,fy+fh-36,fw,36); }
    else if(tp==='barber'){ glass('#fde2e4'); for(let k=0;k<3;k++){ g.fillStyle='#333'; g.fillRect(fx+18+k*(fw-36)/3,fy+fh-50,26,40); }
      for(let q=0;q<10;q++){ g.fillStyle=q%3===0?'#e63946':q%3===1?'#fff':'#1d3557'; g.fillRect(fx+fw-16,fy+6+q*9,10,9); } }
    // 門口地台、玻璃反光
    g.fillStyle='rgba(255,255,255,.22)'; g.fillRect(fx+fw*0.62,fy,10,fh);
  }
  const mk=k=>texMat('sg'+k,canvasTex(1024,192,(g,w,h)=>{ g.fillStyle='#efe8da'; g.fillRect(0,0,w,h); for(let q=0;q<4;q++) front(g,q*256,256,h,KINDS[(k*4+q*7+(drnd()*3|0))%KINDS.length]); }));
  const n=GFX>=2?14:10; const nm=[]; for(let k=0;k<n;k++) nm.push(mk(k));
  for(let k=0;k<shopMats.length;k++) shopMats[k]=nm[k];   // 保持 pick(shopMats) 次數一樣（城市唔會變樣）
  shopMats.length=0; shopMats.push(...nm);
}

/* ---------- 合併幾何（任意四邊形底） ---------- */
const buckets=new Map();
function bucket(mat){ if(!buckets.has(mat)) buckets.set(mat,{p:[],n:[],u:[]}); return buckets.get(mat); }
// c：四個角 [[x,z]×4]（任何次序順時針／逆時針都得）
function boxQ(c,y0,y1,sideMat,topMat,us=8,vs=3,uOff=0){
  const cx=(c[0][0]+c[1][0]+c[2][0]+c[3][0])/4, cz=(c[0][1]+c[1][1]+c[2][1]+c[3][1])/4;
  if(!topMat||topMat===roofMat) topMat=roofMats[Math.abs((cx*7+cz*13)|0)%roofMats.length];
  const sb=bucket(sideMat), tb=bucket(topMat);
  for(let i=0;i<4;i++){ let P=c[i], Q=c[(i+1)%4]; const ex=Q[0]-P[0], ez=Q[1]-P[1], L=Math.hypot(ex,ez)||1;
    let nx=ez/L, nz=-ex/L; const mx=(P[0]+Q[0])/2-cx, mz=(P[1]+Q[1])/2-cz; if(nx*mx+nz*mz<0){ nx=-nx; nz=-nz; }
    // 由外面望：左→右 = (nz,-nx)
    if(ex*nz+ez*(-nx)<0){ const t=P; P=Q; Q=t; }
    const u1=uOff+L/us, v1=(y1-y0)/vs;
    sb.p.push(P[0],y0,P[1], Q[0],y0,Q[1], Q[0],y1,Q[1],  P[0],y0,P[1], Q[0],y1,Q[1], P[0],y1,P[1]);
    for(let k=0;k<6;k++) sb.n.push(nx,0,nz);
    sb.u.push(uOff,0, u1,0, u1,v1,  uOff,0, u1,v1, uOff,v1); }
  const tri=(A,B,Cc)=>{ const y=(B[1]-A[1])*(Cc[0]-A[0])-(B[0]-A[0])*(Cc[1]-A[1]); const T=y>=0?[A,B,Cc]:[A,Cc,B];
    T.forEach(p=>{ tb.p.push(p[0],y1,p[1]); tb.n.push(0,1,0); const s=topMat===walkMat?3:8; tb.u.push(p[0]/s,p[1]/s); }); };
  tri(c[0],c[1],c[2]); tri(c[0],c[2],c[3]);
}
const rectQ=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
// 分區合併：每 200 米一格各自一個 mesh，鏡頭睇唔到嘅格（同影子）會自動唔畫
const CHUNK=200;
function flushBuckets(){ buckets.forEach((b,mat)=>{ const P=b.p,N=b.n,U=b.u;
  if(typeof ELEV==='function') for(let i=0;i<P.length;i+=3) P[i+1]+=ELEV(P[i],P[i+2]);   // 元朗公路高架：抬高路面同橋身
  const groups=new Map(); const tri=P.length%9===0&&U.length*3===P.length*2;
  if(!tri) groups.set('all',{p:P,n:N,u:U});
  else for(let t=0;t<P.length;t+=9){ const k=Math.floor((P[t]+P[t+3]+P[t+6])/3/CHUNK)+','+Math.floor((P[t+2]+P[t+5]+P[t+8])/3/CHUNK);
    let g=groups.get(k); if(!g){ g={p:[],n:[],u:[]}; groups.set(k,g); }
    for(let j=0;j<9;j++){ g.p.push(P[t+j]); g.n.push(N[t+j]); } const uo=t/9*6; for(let j=0;j<6;j++) g.u.push(U[uo+j]); }
  groups.forEach(gp=>{ const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(gp.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(gp.n,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(gp.u,2));
    g.computeBoundingSphere(); const m=new THREE.Mesh(g,mat); m.castShadow=true; m.receiveShadow=true; m.matrixAutoUpdate=false; m.updateMatrix(); scene.add(m); }); }); buckets.clear(); }
// 山丘：半球體，合併入同一批幾何
const HILLG=new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2).toNonIndexed();
function hillQ(x,z,r,h,r2,rot,mat){ const bk=bucket(mat), P=HILLG.attributes.position.array, N=HILLG.attributes.normal.array, U=HILLG.attributes.uv.array, c=Math.cos(rot), s=Math.sin(rot);
  for(let i=0;i<P.length;i+=3){ const lx=P[i]*r, lz=P[i+2]*r2; bk.p.push(x+lx*c-lz*s,P[i+1]*h,z+lx*s+lz*c); const nx=N[i]/r, ny=N[i+1]/h, nz=N[i+2]/r2, L=Math.hypot(nx,ny,nz)||1; bk.n.push(nx/L,ny/L,nz/L); }
  for(let i=0;i<U.length;i++) bk.u.push(U[i]*4); }
// 平面（帶世界坐標 UV）
function flat(arr,mat,y,uvs=3){ // 統一三角形方向（由上面望係逆時針），法線向上；按 200 米分區，元朗公路高架段跟住抬高
  for(let i=0;i<arr.length;i+=9){ const ax=arr[i],az=arr[i+2],bx=arr[i+3],bz=arr[i+5],cx=arr[i+6],cz=arr[i+8]; if((bz-az)*(cx-ax)-(bx-ax)*(cz-az)<0){ arr[i+3]=cx; arr[i+5]=cz; arr[i+6]=bx; arr[i+8]=bz; } }
  if(typeof ELEV==='function') for(let i=0;i<arr.length;i+=3) arr[i+1]+=ELEV(arr[i],arr[i+2]);
  const groups=new Map(); for(let t=0;t<arr.length;t+=9){ const k=Math.floor((arr[t]+arr[t+3]+arr[t+6])/3/CHUNK)+','+Math.floor((arr[t+2]+arr[t+5]+arr[t+8])/3/CHUNK);
    let g=groups.get(k); if(!g){ g=[]; groups.set(k,g); } for(let j=0;j<9;j++) g.push(arr[t+j]); }
  let last=null; groups.forEach(a=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));
    const uv=[]; for(let i=0;i<a.length;i+=3) uv.push(a[i]/uvs,a[i+2]/uvs); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const n=[]; for(let i=0;i<a.length;i+=3) n.push(0,1,0); g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3)); g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat); m.position.y=y||0; m.receiveShadow=true; m.matrixAutoUpdate=false; m.updateMatrix(); scene.add(m); last=m; }); return last; }
const ribbon=(arr,A,B,half)=>{ const dx=B[0]-A[0], dz=B[1]-A[1], L=Math.hypot(dx,dz)||1; const nx=dz/L*half, nz=-dx/L*half;
  arr.push(A[0]+nx,0,A[1]+nz, B[0]+nx,0,B[1]+nz, B[0]-nx,0,B[1]-nz,  A[0]+nx,0,A[1]+nz, B[0]-nx,0,B[1]-nz, A[0]-nx,0,A[1]-nz); };
const disc=(arr,C0,r,seg=16)=>{ for(let i=0;i<seg;i++){ const a=i/seg*Math.PI*2, b=(i+1)/seg*Math.PI*2; arr.push(C0[0],0,C0[1], C0[0]+Math.cos(a)*r,0,C0[1]+Math.sin(a)*r, C0[0]+Math.cos(b)*r,0,C0[1]+Math.sin(b)*r); } };
const quadA=(arr,c)=>arr.push(c[0][0],0,c[0][1], c[1][0],0,c[1][1], c[2][0],0,c[2][1], c[0][0],0,c[0][1], c[2][0],0,c[2][1], c[3][0],0,c[3][1]);

/* ---------- 版圖（簡化真實屯門） ---------- */
const REGION=(()=>{ try{ const v=JSON.parse(localStorage.getItem('a188.region')||'"tm"'); return v==='st'?'st':'tm'; }catch(e){ return 'tm'; } })();   // 地區：屯門（連元朗、天水圍）／沙田（獨立地圖）
const LAY=REGION==='st'?{"S":0.4,"nodes":[[132.0,56.0],[148.4,34.0],[163.0,10.0],[172.0,-8.0],[181.1,-31.6],[192.0,-60.0],[202.9,-83.6],[216.0,-112.0],[226.9,-135.6],[240.0,-164.0],[250.9,-185.8],[264.0,-212.0],[279.4,-230.5],[294.8,-248.9],[304.0,-260.0],[319.8,-279.7],[337.0,-301.3],[352.0,-320.5],[367.0,-340.1],[381.9,-359.9],[401.8,-385.5],[417.5,-405.0],[440.0,-432.0],[456.7,-450.9],[473.3,-469.8],[490.0,-488.7],[500.0,-500.0],[107.2,65.0],[80.7,72.2],[48.0,76.0],[0.0,0.0],[15.8,22.5],[31.4,46.6],[144.4,-8.0],[119.5,-7.9],[92.9,-7.2],[65.9,-5.8],[38.5,-3.5],[13.8,-1.2],[165.8,-66.6],[142.0,-72.5],[117.0,-79.1],[92.0,-86.1],[67.0,-93.5],[32.0,-104.0],[191.1,-117.2],[163.9,-123.2],[136.5,-130.9],[110.2,-140.2],[87.9,-149.4],[72.0,-156.0],[215.5,-174.5],[187.9,-186.1],[161.2,-196.8],[132.0,-208.0],[250.9,-242.2],[239.0,-269.5],[228.7,-292.8],[218.2,-316.3],[207.5,-340.0],[196.8,-363.2],[180.0,-400.0],[-12.2,-21.6],[-26.0,-46.0],[-38.9,-68.6],[-51.5,-90.5],[-63.9,-111.6],[-79.0,-137.0],[-92.5,-159.5],[-100.0,-172.0],[-360.0,400.0],[-344.8,380.7],[-329.7,361.4],[-314.5,342.1],[-299.3,322.8],[-284.1,303.4],[-272.0,288.0],[-254.0,266.9],[-238.5,248.6],[-220.2,227.2],[-200.8,204.8],[-181.0,182.2],[-164.9,164.2],[-148.6,146.2],[-132.1,128.2],[-115.6,110.6],[-95.8,90.0],[-76.9,70.9],[-58.9,53.4],[-40.0,36.0],[-18.8,16.9],[-294.1,277.0],[-316.1,265.9],[-338.2,254.9],[-360.3,243.9],[-382.3,232.8],[-400.0,224.0],[-333.8,408.4],[-306.3,417.2],[-283.1,424.6],[-255.4,432.6],[-227.9,439.9],[-200.8,446.5],[-175.4,452.1],[-150.1,457.8],[-140.0,460.0],[-118.1,447.5],[-94.1,433.8],[-70.0,420.0],[-48.1,407.4],[-26.2,394.4],[-4.4,381.2],[17.5,367.7],[39.4,353.8],[61.2,339.8],[83.9,324.9],[107.2,309.6],[140.0,288.0],[162.6,278.5],[185.3,269.1],[207.9,259.6],[230.5,250.1],[253.2,240.6],[275.8,231.2],[298.4,221.7],[312.0,216.0],[331.4,193.5],[348.8,173.2],[366.2,153.0],[385.5,130.4],[402.9,109.0],[417.6,90.0],[432.1,70.5],[446.2,50.6],[460.0,30.2],[473.5,9.4],[486.7,-11.9],[500.2,-34.2],[515.6,-59.7],[530.2,-83.9],[540.0,-100.0],[561.2,-111.2],[582.5,-122.5],[608.0,-136.0],[627.0,-151.2],[646.1,-166.5],[665.1,-181.7],[688.0,-200.0],[-116.6,465.6],[-90.0,472.0],[-65.9,477.9],[-38.1,484.9],[-13.2,491.5],[15.1,499.3],[32.0,504.0],[162.8,305.5],[182.1,320.1],[206.9,337.9],[228.8,352.5],[240.0,360.0],[615.5,-108.8],[622.0,-85.2],[628.5,-60.8],[634.3,-34.9],[639.5,-7.8],[643.9,20.9],[647.0,44.8],[649.6,68.6],[652.2,93.3],[656.0,128.0],[151.7,80.9],[170.0,103.6],[188.7,123.1],[209.2,141.4],[230.4,158.4],[254.5,175.8],[278.2,192.4],[300.8,208.1],[267.3,-160.1],[296.1,-156.0],[324.7,-151.8],[348.6,-147.7],[373.1,-143.0],[396.6,-137.9],[420.6,-132.2],[445.1,-126.0],[470.0,-119.2],[497.5,-111.7],[525.0,-104.1],[331.5,-261.9],[356.2,-263.6],[381.0,-265.2],[408.6,-266.8],[437.0,-266.4],[466.1,-264.0],[491.2,-260.4],[515.6,-255.6],[540.5,-249.5],[565.9,-242.0],[591.8,-233.3],[615.2,-225.2],[639.2,-216.9],[662.0,-209.0]],"edges":[{"a":0,"b":1,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":1,"b":2,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":2,"b":3,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":3,"b":4,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":4,"b":5,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":5,"b":6,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":6,"b":7,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":7,"b":8,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":8,"b":9,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":9,"b":10,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":10,"b":11,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":11,"b":12,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":12,"b":13,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":13,"b":14,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":14,"b":15,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":15,"b":16,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":16,"b":17,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":17,"b":18,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":18,"b":19,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":19,"b":20,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":20,"b":21,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":21,"b":22,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":22,"b":23,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":23,"b":24,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":24,"b":25,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":25,"b":26,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":0,"b":27,"t":"street","name":"\u62c5\u6746\u8386\u8857"},{"a":27,"b":28,"t":"street","name":"\u62c5\u6746\u8386\u8857"},{"a":28,"b":29,"t":"street","name":"\u62c5\u6746\u8386\u8857"},{"a":30,"b":31,"t":"street","name":"\u6c99\u7530\u6b63\u8857"},{"a":31,"b":32,"t":"street","name":"\u6c99\u7530\u6b63\u8857"},{"a":32,"b":29,"t":"street","name":"\u6c99\u7530\u6b63\u8857"},{"a":3,"b":33,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":33,"b":34,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":34,"b":35,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":35,"b":36,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":36,"b":37,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":37,"b":38,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":38,"b":30,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":5,"b":39,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":39,"b":40,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":40,"b":41,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":41,"b":42,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":42,"b":43,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":43,"b":44,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":7,"b":45,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":45,"b":46,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":46,"b":47,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":47,"b":48,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":48,"b":49,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":49,"b":50,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":9,"b":51,"t":"street","name":"\u5fb7\u539a\u8857"},{"a":51,"b":52,"t":"street","name":"\u5fb7\u539a\u8857"},{"a":52,"b":53,"t":"street","name":"\u5fb7\u539a\u8857"},{"a":53,"b":54,"t":"street","name":"\u5fb7\u539a\u8857"},{"a":11,"b":55,"t":"street","name":"\u706b\u70ad\u8def"},{"a":55,"b":56,"t":"street","name":"\u706b\u70ad\u8def"},{"a":56,"b":57,"t":"street","name":"\u706b\u70ad\u8def"},{"a":57,"b":58,"t":"street","name":"\u706b\u70ad\u8def"},{"a":58,"b":59,"t":"street","name":"\u706b\u70ad\u8def"},{"a":59,"b":60,"t":"street","name":"\u706b\u70ad\u8def"},{"a":60,"b":61,"t":"street","name":"\u706b\u70ad\u8def"},{"a":30,"b":62,"t":"street","name":"\u6392\u982d\u8857"},{"a":62,"b":63,"t":"street","name":"\u6392\u982d\u8857"},{"a":63,"b":64,"t":"street","name":"\u6392\u982d\u8857"},{"a":64,"b":65,"t":"street","name":"\u6392\u982d\u8857"},{"a":65,"b":66,"t":"street","name":"\u6392\u982d\u8857"},{"a":66,"b":67,"t":"street","name":"\u6392\u982d\u8857"},{"a":67,"b":68,"t":"street","name":"\u6392\u982d\u8857"},{"a":68,"b":69,"t":"street","name":"\u6392\u982d\u8857"},{"a":70,"b":71,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":71,"b":72,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":72,"b":73,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":73,"b":74,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":74,"b":75,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":75,"b":76,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":76,"b":77,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":77,"b":78,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":78,"b":79,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":79,"b":80,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":80,"b":81,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":81,"b":82,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":82,"b":83,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":83,"b":84,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":84,"b":85,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":85,"b":86,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":86,"b":87,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":87,"b":88,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":88,"b":89,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":89,"b":90,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":90,"b":30,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":76,"b":91,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":91,"b":92,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":92,"b":93,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":93,"b":94,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":94,"b":95,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":95,"b":96,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":70,"b":97,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":97,"b":98,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":98,"b":99,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":99,"b":100,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":100,"b":101,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":101,"b":102,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":102,"b":103,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":103,"b":104,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":104,"b":105,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":105,"b":106,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":106,"b":107,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":107,"b":108,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":108,"b":109,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":109,"b":110,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":110,"b":111,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":111,"b":112,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":112,"b":113,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":113,"b":114,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":114,"b":115,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":115,"b":116,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":116,"b":117,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":117,"b":118,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":118,"b":119,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":119,"b":120,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":120,"b":121,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":121,"b":122,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":122,"b":123,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":123,"b":124,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":124,"b":125,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":125,"b":126,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":126,"b":127,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":127,"b":128,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":128,"b":129,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":129,"b":130,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":130,"b":131,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":131,"b":132,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":132,"b":133,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":133,"b":134,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":134,"b":135,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":135,"b":136,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":136,"b":137,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":137,"b":138,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":138,"b":139,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":139,"b":140,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":140,"b":141,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":141,"b":142,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":142,"b":143,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":143,"b":144,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":144,"b":145,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":145,"b":146,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":146,"b":147,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":105,"b":148,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":148,"b":149,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":149,"b":150,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":150,"b":151,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":151,"b":152,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":152,"b":153,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":153,"b":154,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":117,"b":155,"t":"street","name":"\u6c99\u89d2\u8857"},{"a":155,"b":156,"t":"street","name":"\u6c99\u89d2\u8857"},{"a":156,"b":157,"t":"street","name":"\u6c99\u89d2\u8857"},{"a":157,"b":158,"t":"street","name":"\u6c99\u89d2\u8857"},{"a":158,"b":159,"t":"street","name":"\u6c99\u89d2\u8857"},{"a":143,"b":160,"t":"street","name":"\u9280\u57ce\u8857"},{"a":160,"b":161,"t":"street","name":"\u9280\u57ce\u8857"},{"a":161,"b":162,"t":"street","name":"\u9280\u57ce\u8857"},{"a":162,"b":163,"t":"street","name":"\u9280\u57ce\u8857"},{"a":163,"b":164,"t":"street","name":"\u9280\u57ce\u8857"},{"a":164,"b":165,"t":"street","name":"\u9280\u57ce\u8857"},{"a":165,"b":166,"t":"street","name":"\u9280\u57ce\u8857"},{"a":166,"b":167,"t":"street","name":"\u9280\u57ce\u8857"},{"a":167,"b":168,"t":"street","name":"\u9280\u57ce\u8857"},{"a":168,"b":169,"t":"street","name":"\u9280\u57ce\u8857"},{"a":0,"b":170,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":170,"b":171,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":171,"b":172,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":172,"b":173,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":173,"b":174,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":174,"b":175,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":175,"b":176,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":176,"b":177,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":177,"b":125,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":9,"b":178,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":178,"b":179,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":179,"b":180,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":180,"b":181,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":181,"b":182,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":182,"b":183,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":183,"b":184,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":184,"b":185,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":185,"b":186,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":186,"b":187,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":187,"b":188,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":188,"b":140,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":14,"b":189,"t":"main","name":"\u6c99\u7530\u8def"},{"a":189,"b":190,"t":"main","name":"\u6c99\u7530\u8def"},{"a":190,"b":191,"t":"main","name":"\u6c99\u7530\u8def"},{"a":191,"b":192,"t":"main","name":"\u6c99\u7530\u8def"},{"a":192,"b":193,"t":"main","name":"\u6c99\u7530\u8def"},{"a":193,"b":194,"t":"main","name":"\u6c99\u7530\u8def"},{"a":194,"b":195,"t":"main","name":"\u6c99\u7530\u8def"},{"a":195,"b":196,"t":"main","name":"\u6c99\u7530\u8def"},{"a":196,"b":197,"t":"main","name":"\u6c99\u7530\u8def"},{"a":197,"b":198,"t":"main","name":"\u6c99\u7530\u8def"},{"a":198,"b":199,"t":"main","name":"\u6c99\u7530\u8def"},{"a":199,"b":200,"t":"main","name":"\u6c99\u7530\u8def"},{"a":200,"b":201,"t":"main","name":"\u6c99\u7530\u8def"},{"a":201,"b":202,"t":"main","name":"\u6c99\u7530\u8def"},{"a":202,"b":147,"t":"main","name":"\u6c99\u7530\u8def"}],"river":[[-560.0,600.0],[-557.2,598.1],[-551.6,594.4],[-543.1,588.8],[-531.9,581.2],[-517.8,571.9],[-500.9,560.6],[-481.2,547.5],[-458.8,532.5],[-435.9,517.8],[-412.8,503.4],[-389.4,489.4],[-365.6,475.6],[-341.6,462.2],[-317.2,449.1],[-292.5,436.2],[-267.5,423.8],[-242.2,411.2],[-216.6,398.8],[-190.6,386.2],[-164.4,373.8],[-137.8,361.2],[-110.9,348.8],[-83.8,336.2],[-56.2,323.8],[-29.4,311.1],[-3.1,298.2],[22.5,285.1],[47.5,271.9],[71.9,258.4],[95.6,244.8],[118.8,231.0],[141.2,217.0],[162.8,202.9],[183.4,188.6],[203.1,174.2],[221.9,159.8],[239.7,145.1],[256.6,130.4],[272.5,115.5],[287.5,100.5],[301.8,85.2],[315.2,69.6],[328.0,53.6],[340.0,37.4],[351.2,20.8],[361.8,3.9],[371.5,-13.2],[380.5,-30.8],[389.2,-47.9],[397.8,-64.6],[406.0,-81.0],[414.0,-97.0],[421.8,-112.6],[429.2,-127.9],[436.5,-142.8],[443.5,-157.2],[450.6,-171.7],[457.7,-186.1],[464.9,-200.4],[472.1,-214.6],[479.4,-228.8],[486.8,-242.9],[494.2,-257.0],[501.8,-271.0],[509.8,-284.8],[518.4,-298.4],[527.6,-311.9],[537.4,-325.1],[547.7,-338.2],[558.6,-351.1],[570.0,-363.8],[582.0,-376.2],[594.9,-388.8],[608.8,-401.2],[623.6,-413.8],[639.4,-426.2],[656.1,-438.8],[673.7,-451.2],[692.2,-463.8],[711.8,-476.2],[731.6,-488.4],[751.9,-500.3],[772.5,-511.9],[793.5,-523.1],[814.9,-534.1],[836.6,-544.7],[858.8,-555.0],[881.2,-565.0],[900.9,-573.8],[917.8,-581.2],[931.9,-587.5],[943.1,-592.5],[951.6,-596.2],[957.2,-598.8],[960.0,-600.0]],"lake":[[236.0,28.0],[237.2,27.6],[239.8,26.9],[243.5,25.8],[248.5,24.2],[252.9,23.9],[256.6,24.6],[259.8,26.5],[262.2,29.5],[263.8,32.9],[264.2,36.6],[263.8,40.8],[262.2,45.2],[259.9,48.9],[256.6,51.6],[252.5,53.5],[247.5,54.5],[243.0,54.5],[239.0,53.5],[235.5,51.5],[232.5,48.5],[230.8,45.2],[230.2,41.8],[231.0,38.0],[233.0,34.0],[234.5,31.0],[235.5,29.0],[236.0,28.0]],"bounds":[-480.0,-620.0,820.0,580.0],"J":{"DG":0,"HB":3,"XS":5,"WC":7,"TH":9,"FT":11,"STR":14,"SI":22,"RC":26,"ZJ":29,"STN":30,"XW":44,"WCW":50,"THW":54,"FTN":61,"PT":69,"TW":70,"TS":76,"TSD":96,"S1":105,"SK":117,"LY":125,"SY":140,"C1":143,"C1E":147,"CK":154,"SKE":159,"PWH":169}}:{"S":0.4,"nodes":[[-152.0,-312.0],[-137.0,-292.5],[-121.9,-273.0],[-106.9,-253.4],[-88.8,-230.0],[-87.5,-200.5],[-86.3,-173.8],[-85.2,-146.2],[-84.1,-119.2],[-83.2,-92.8],[-82.0,-56.0],[-79.0,-31.0],[-76.0,-6.0],[-73.0,19.0],[-71.2,34.0],[-82.9,59.9],[-94.4,81.9],[-107.8,102.5],[-120.0,120.0],[-127.9,146.2],[-136.2,175.9],[-142.7,204.5],[-148.8,236.0],[-154.2,260.3],[-159.7,284.6],[-164.0,304.0],[-128.4,-318.6],[-102.6,-325.2],[-76.8,-328.2],[-52.0,-326.8],[-26.0,-321.9],[-16.0,-320.0],[-7.0,-342.5],[4.9,-368.4],[18.4,-393.7],[24.0,-404.0],[-256.0,-224.0],[-231.1,-229.2],[-203.5,-234.6],[-178.1,-236.8],[-151.3,-236.5],[-123.7,-233.8],[-60.8,-228.7],[-36.8,-229.1],[-12.0,-231.2],[15.0,-244.5],[39.0,-253.1],[63.0,-256.6],[87.0,-257.2],[111.0,-256.2],[132.0,-254.8],[-13.1,-255.9],[-14.2,-280.5],[-15.3,-305.2],[-256.0,-44.0],[-227.1,-45.3],[-201.0,-46.5],[-173.7,-48.1],[-146.6,-50.1],[-119.6,-52.5],[-95.4,-54.8],[-56.0,-58.1],[-31.8,-44.2],[-13.4,-20.4],[2.9,1.2],[17.6,20.8],[-69.6,-83.0],[-54.6,-103.2],[-33.0,-117.5],[-12.0,-128.0],[-12.0,-152.6],[-12.0,-177.1],[-12.0,-201.7],[46.0,11.4],[70.8,1.2],[95.0,-11.8],[116.0,-24.0],[160.0,-360.0],[154.2,-333.8],[148.0,-305.9],[140.8,-277.8],[144.2,-230.8],[156.4,-202.2],[162.2,-178.5],[164.6,-152.6],[160.5,-127.0],[153.1,-103.8],[143.1,-80.2],[130.6,-54.4],[118.2,3.0],[115.9,31.4],[109.5,57.2],[101.6,82.2],[96.0,100.0],[97.8,129.8],[99.8,154.1],[105.1,181.2],[115.6,211.6],[129.8,239.8],[142.3,262.6],[160.6,286.8],[178.6,303.6],[188.0,312.0],[193.2,336.5],[198.1,364.5],[200.0,392.5],[200.0,424.0],[204.0,448.0],[208.0,472.0],[-256.0,208.0],[-232.7,214.1],[-209.4,220.2],[-186.1,226.3],[-162.8,232.3],[-118.7,245.6],[-93.5,252.8],[-62.7,257.0],[-35.4,256.1],[-8.2,252.9],[12.0,248.8],[35.3,241.8],[68.0,232.0],[91.8,221.8],[16.0,45.3],[14.3,69.7],[12.0,104.0],[8.7,128.9],[5.4,156.1],[4.5,183.6],[6.4,210.1],[10.4,238.1],[7.6,273.9],[4.0,294.0],[7.8,319.0],[10.0,334.0],[10.7,358.3],[11.3,382.6],[12.0,406.9],[12.8,436.0],[12.8,461.7],[12.8,472.0],[75.0,256.0],[82.0,280.0],[88.8,305.0],[92.8,320.0],[96.0,348.0],[99.3,378.5],[102.1,405.0],[104.8,432.0],[28.4,289.6],[52.8,285.2],[34.4,329.9],[58.7,325.8],[37.0,434.9],[61.2,433.9],[85.4,432.8],[129.0,430.2],[155.1,428.2],[182.5,425.8],[71.2,98.9],[44.7,99.5],[12.9,-327.9],[39.0,-334.9],[66.5,-341.8],[94.0,-347.8],[121.5,-353.0],[146.2,-357.5],[176.0,-378.7],[192.0,-397.3],[208.0,-416.0],[224.0,-434.7],[240.0,-453.3],[256.0,-472.0],[274.1,-488.2],[294.1,-506.1],[314.0,-524.0],[335.5,-543.2],[354.1,-559.8],[372.2,-576.0],[394.3,-595.6],[415.8,-614.5],[435.5,-631.9],[456.4,-650.2],[472.0,-664.0],[253.2,-500.1],[250.8,-524.5],[248.5,-549.8],[247.2,-576.2],[247.0,-603.9],[247.9,-632.8],[249.8,-662.9],[251.7,-687.3],[253.8,-716.7],[255.5,-744.9],[256.9,-771.8],[257.9,-797.5],[258.9,-826.2],[260.0,-860.0],[160.0,-860.0],[185.0,-860.0],[210.0,-860.0],[235.0,-860.0],[285.0,-860.0],[310.0,-860.0],[335.0,-860.0],[360.0,-860.0],[260.0,-884.2],[260.0,-908.4],[260.0,-932.6],[260.0,-952.0],[260.0,-976.2],[260.0,-1000.4],[260.0,-1024.6],[260.0,-1044.0],[160.0,-952.0],[185.0,-952.0],[210.0,-952.0],[235.0,-952.0],[285.0,-952.0],[310.0,-952.0],[335.0,-952.0],[360.0,-952.0],[160.0,-1044.0],[185.0,-1044.0],[210.0,-1044.0],[235.0,-1044.0],[285.0,-1044.0],[310.0,-1044.0],[335.0,-1044.0],[360.0,-1044.0],[160.0,-884.2],[160.0,-908.4],[160.0,-932.6],[160.0,-976.2],[160.0,-1000.4],[160.0,-1024.6],[360.0,-884.2],[360.0,-908.4],[360.0,-932.6],[360.0,-976.2],[360.0,-1000.4],[360.0,-1024.6],[135.7,-952.0],[111.4,-952.0],[92.0,-952.0],[388.0,-847.8],[410.9,-836.9],[436.1,-820.6],[456.1,-803.9],[478.0,-790.8],[496.0,-784.0],[496.8,-667.8],[521.5,-671.6],[546.3,-675.4],[576.0,-680.0],[600.8,-680.0],[625.5,-680.0],[650.3,-680.0],[680.0,-680.0],[704.8,-680.0],[729.5,-680.0],[754.3,-680.0],[784.0,-680.0],[806.5,-689.0],[831.5,-702.8],[850.9,-717.5],[864.0,-728.0],[476.8,-688.0],[481.6,-712.0],[486.4,-736.0],[491.2,-760.0],[521.0,-784.0],[546.0,-784.0],[576.0,-784.0],[600.8,-784.0],[625.5,-784.0],[650.3,-784.0],[680.0,-784.0],[576.0,-759.2],[576.0,-734.5],[576.0,-709.7],[680.0,-759.2],[680.0,-734.5],[680.0,-709.7],[576.0,-656.0],[576.0,-632.0],[576.0,-608.0],[576.0,-584.0],[680.0,-656.0],[680.0,-632.0],[680.0,-608.0],[680.0,-584.0],[600.8,-584.0],[625.5,-584.0],[650.3,-584.0],[704.8,-584.0],[729.5,-584.0],[754.3,-584.0],[784.0,-584.0],[784.0,-656.0],[784.0,-632.0],[784.0,-608.0]],"edges":[{"a":0,"b":1,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":1,"b":2,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":2,"b":3,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":3,"b":4,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":4,"b":5,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":5,"b":6,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":6,"b":7,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":7,"b":8,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":8,"b":9,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":9,"b":10,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":10,"b":11,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":11,"b":12,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":12,"b":13,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":13,"b":14,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":14,"b":15,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":15,"b":16,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":16,"b":17,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":17,"b":18,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":18,"b":19,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":19,"b":20,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":20,"b":21,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":21,"b":22,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":22,"b":23,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":23,"b":24,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":24,"b":25,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":0,"b":26,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":26,"b":27,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":27,"b":28,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":28,"b":29,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":29,"b":30,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":30,"b":31,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":31,"b":32,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":32,"b":33,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":33,"b":34,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":34,"b":35,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":36,"b":37,"t":"main","name":"\u9752\u7530\u8def"},{"a":37,"b":38,"t":"main","name":"\u9752\u7530\u8def"},{"a":38,"b":39,"t":"main","name":"\u9752\u7530\u8def"},{"a":39,"b":40,"t":"main","name":"\u9752\u7530\u8def"},{"a":40,"b":41,"t":"main","name":"\u9752\u7530\u8def"},{"a":41,"b":4,"t":"main","name":"\u9752\u7530\u8def"},{"a":4,"b":42,"t":"main","name":"\u9752\u7530\u8def"},{"a":42,"b":43,"t":"main","name":"\u9752\u7530\u8def"},{"a":43,"b":44,"t":"main","name":"\u9752\u7530\u8def"},{"a":44,"b":45,"t":"main","name":"\u9752\u7530\u8def"},{"a":45,"b":46,"t":"main","name":"\u9752\u7530\u8def"},{"a":46,"b":47,"t":"main","name":"\u9752\u7530\u8def"},{"a":47,"b":48,"t":"main","name":"\u9752\u7530\u8def"},{"a":48,"b":49,"t":"main","name":"\u9752\u7530\u8def"},{"a":49,"b":50,"t":"main","name":"\u9752\u7530\u8def"},{"a":44,"b":51,"t":"street","name":"\u91ab\u9662\u8def"},{"a":51,"b":52,"t":"street","name":"\u91ab\u9662\u8def"},{"a":52,"b":53,"t":"street","name":"\u91ab\u9662\u8def"},{"a":53,"b":31,"t":"street","name":"\u91ab\u9662\u8def"},{"a":54,"b":55,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":55,"b":56,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":56,"b":57,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":57,"b":58,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":58,"b":59,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":59,"b":60,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":60,"b":10,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":10,"b":61,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":61,"b":62,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":62,"b":63,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":63,"b":64,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":64,"b":65,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":10,"b":66,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":66,"b":67,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":67,"b":68,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":68,"b":69,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":69,"b":70,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":70,"b":71,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":71,"b":72,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":72,"b":44,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":65,"b":73,"t":"street","name":"\u65b0\u589f\u8def"},{"a":73,"b":74,"t":"street","name":"\u65b0\u589f\u8def"},{"a":74,"b":75,"t":"street","name":"\u65b0\u589f\u8def"},{"a":75,"b":76,"t":"street","name":"\u65b0\u589f\u8def"},{"a":77,"b":78,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":78,"b":79,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":79,"b":80,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":80,"b":50,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":50,"b":81,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":81,"b":82,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":82,"b":83,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":83,"b":84,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":84,"b":85,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":85,"b":86,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":86,"b":87,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":87,"b":88,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":88,"b":76,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":76,"b":89,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":89,"b":90,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":90,"b":91,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":91,"b":92,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":92,"b":93,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":93,"b":94,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":94,"b":95,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":95,"b":96,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":96,"b":97,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":97,"b":98,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":98,"b":99,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":99,"b":100,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":100,"b":101,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":101,"b":102,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":102,"b":103,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":103,"b":104,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":104,"b":105,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":105,"b":106,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":106,"b":107,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":107,"b":108,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":109,"b":110,"t":"main","name":"\u676f\u6e21\u8def"},{"a":110,"b":111,"t":"main","name":"\u676f\u6e21\u8def"},{"a":111,"b":112,"t":"main","name":"\u676f\u6e21\u8def"},{"a":112,"b":113,"t":"main","name":"\u676f\u6e21\u8def"},{"a":113,"b":22,"t":"main","name":"\u676f\u6e21\u8def"},{"a":22,"b":114,"t":"main","name":"\u676f\u6e21\u8def"},{"a":114,"b":115,"t":"main","name":"\u676f\u6e21\u8def"},{"a":115,"b":116,"t":"main","name":"\u676f\u6e21\u8def"},{"a":116,"b":117,"t":"main","name":"\u676f\u6e21\u8def"},{"a":117,"b":118,"t":"main","name":"\u676f\u6e21\u8def"},{"a":118,"b":119,"t":"main","name":"\u676f\u6e21\u8def"},{"a":119,"b":120,"t":"main","name":"\u676f\u6e21\u8def"},{"a":120,"b":121,"t":"main","name":"\u676f\u6e21\u8def"},{"a":121,"b":122,"t":"main","name":"\u676f\u6e21\u8def"},{"a":122,"b":97,"t":"main","name":"\u676f\u6e21\u8def"},{"a":65,"b":123,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":123,"b":124,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":124,"b":125,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":125,"b":126,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":126,"b":127,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":127,"b":128,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":128,"b":129,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":129,"b":130,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":130,"b":119,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":119,"b":131,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":131,"b":132,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":132,"b":133,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":133,"b":134,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":134,"b":135,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":135,"b":136,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":136,"b":137,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":137,"b":138,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":138,"b":139,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":139,"b":140,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":121,"b":141,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":141,"b":142,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":142,"b":143,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":143,"b":144,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":144,"b":145,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":145,"b":146,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":146,"b":147,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":147,"b":148,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":132,"b":149,"t":"street","name":"\u5c6f\u9806\u8857"},{"a":149,"b":150,"t":"street","name":"\u5c6f\u9806\u8857"},{"a":150,"b":142,"t":"street","name":"\u5c6f\u9806\u8857"},{"a":134,"b":151,"t":"street","name":"\u5c6f\u76db\u8857"},{"a":151,"b":152,"t":"street","name":"\u5c6f\u76db\u8857"},{"a":152,"b":144,"t":"street","name":"\u5c6f\u76db\u8857"},{"a":138,"b":153,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":153,"b":154,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":154,"b":155,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":155,"b":148,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":148,"b":156,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":156,"b":157,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":157,"b":158,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":158,"b":106,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":93,"b":159,"t":"street","name":"\u5c6f\u8cb4\u8def"},{"a":159,"b":160,"t":"street","name":"\u5c6f\u8cb4\u8def"},{"a":160,"b":125,"t":"street","name":"\u5c6f\u8cb4\u8def"},{"a":31,"b":161,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":161,"b":162,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":162,"b":163,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":163,"b":164,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":164,"b":165,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":165,"b":166,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":166,"b":77,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":77,"b":167,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":167,"b":168,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":168,"b":169,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":169,"b":170,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":170,"b":171,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":171,"b":172,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":172,"b":173,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":173,"b":174,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":174,"b":175,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":175,"b":176,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":176,"b":177,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":177,"b":178,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":178,"b":179,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":179,"b":180,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":180,"b":181,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":181,"b":182,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":182,"b":183,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":172,"b":184,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":184,"b":185,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":185,"b":186,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":186,"b":187,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":187,"b":188,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":188,"b":189,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":189,"b":190,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":190,"b":191,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":191,"b":192,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":192,"b":193,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":193,"b":194,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":194,"b":195,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":195,"b":196,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":196,"b":197,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":198,"b":199,"t":"main","name":"\u5929\u745e\u8def"},{"a":199,"b":200,"t":"main","name":"\u5929\u745e\u8def"},{"a":200,"b":201,"t":"main","name":"\u5929\u745e\u8def"},{"a":201,"b":197,"t":"main","name":"\u5929\u745e\u8def"},{"a":197,"b":202,"t":"main","name":"\u5929\u745e\u8def"},{"a":202,"b":203,"t":"main","name":"\u5929\u745e\u8def"},{"a":203,"b":204,"t":"main","name":"\u5929\u745e\u8def"},{"a":204,"b":205,"t":"main","name":"\u5929\u745e\u8def"},{"a":197,"b":206,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":206,"b":207,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":207,"b":208,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":208,"b":209,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":209,"b":210,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":210,"b":211,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":211,"b":212,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":212,"b":213,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":214,"b":215,"t":"street","name":"\u5929\u6e56\u8def"},{"a":215,"b":216,"t":"street","name":"\u5929\u6e56\u8def"},{"a":216,"b":217,"t":"street","name":"\u5929\u6e56\u8def"},{"a":217,"b":209,"t":"street","name":"\u5929\u6e56\u8def"},{"a":209,"b":218,"t":"street","name":"\u5929\u6e56\u8def"},{"a":218,"b":219,"t":"street","name":"\u5929\u6e56\u8def"},{"a":219,"b":220,"t":"street","name":"\u5929\u6e56\u8def"},{"a":220,"b":221,"t":"street","name":"\u5929\u6e56\u8def"},{"a":222,"b":223,"t":"street","name":"\u5929\u6069\u8def"},{"a":223,"b":224,"t":"street","name":"\u5929\u6069\u8def"},{"a":224,"b":225,"t":"street","name":"\u5929\u6069\u8def"},{"a":225,"b":213,"t":"street","name":"\u5929\u6069\u8def"},{"a":213,"b":226,"t":"street","name":"\u5929\u6069\u8def"},{"a":226,"b":227,"t":"street","name":"\u5929\u6069\u8def"},{"a":227,"b":228,"t":"street","name":"\u5929\u6069\u8def"},{"a":228,"b":229,"t":"street","name":"\u5929\u6069\u8def"},{"a":198,"b":230,"t":"street","name":"\u5929\u57ce\u8def"},{"a":230,"b":231,"t":"street","name":"\u5929\u57ce\u8def"},{"a":231,"b":232,"t":"street","name":"\u5929\u57ce\u8def"},{"a":232,"b":214,"t":"street","name":"\u5929\u57ce\u8def"},{"a":214,"b":233,"t":"street","name":"\u5929\u57ce\u8def"},{"a":233,"b":234,"t":"street","name":"\u5929\u57ce\u8def"},{"a":234,"b":235,"t":"street","name":"\u5929\u57ce\u8def"},{"a":235,"b":222,"t":"street","name":"\u5929\u57ce\u8def"},{"a":205,"b":236,"t":"street","name":"\u5929\u83ef\u8def"},{"a":236,"b":237,"t":"street","name":"\u5929\u83ef\u8def"},{"a":237,"b":238,"t":"street","name":"\u5929\u83ef\u8def"},{"a":238,"b":221,"t":"street","name":"\u5929\u83ef\u8def"},{"a":221,"b":239,"t":"street","name":"\u5929\u83ef\u8def"},{"a":239,"b":240,"t":"street","name":"\u5929\u83ef\u8def"},{"a":240,"b":241,"t":"street","name":"\u5929\u83ef\u8def"},{"a":241,"b":229,"t":"street","name":"\u5929\u83ef\u8def"},{"a":214,"b":242,"t":"street","name":"\u5929\u58c7\u8857"},{"a":242,"b":243,"t":"street","name":"\u5929\u58c7\u8857"},{"a":243,"b":244,"t":"street","name":"\u5929\u58c7\u8857"},{"a":205,"b":245,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":245,"b":246,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":246,"b":247,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":247,"b":248,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":248,"b":249,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":249,"b":250,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":183,"b":251,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":251,"b":252,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":252,"b":253,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":253,"b":254,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":254,"b":255,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":255,"b":256,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":256,"b":257,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":257,"b":258,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":258,"b":259,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":259,"b":260,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":260,"b":261,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":261,"b":262,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":262,"b":263,"t":"main","name":"\u5773\u982d\u8def"},{"a":263,"b":264,"t":"main","name":"\u5773\u982d\u8def"},{"a":264,"b":265,"t":"main","name":"\u5773\u982d\u8def"},{"a":265,"b":266,"t":"main","name":"\u5773\u982d\u8def"},{"a":183,"b":267,"t":"main","name":"\u6717\u5929\u8def"},{"a":267,"b":268,"t":"main","name":"\u6717\u5929\u8def"},{"a":268,"b":269,"t":"main","name":"\u6717\u5929\u8def"},{"a":269,"b":270,"t":"main","name":"\u6717\u5929\u8def"},{"a":270,"b":250,"t":"main","name":"\u6717\u5929\u8def"},{"a":250,"b":271,"t":"street","name":"\u6717\u65e5\u8def"},{"a":271,"b":272,"t":"street","name":"\u6717\u65e5\u8def"},{"a":272,"b":273,"t":"street","name":"\u6717\u65e5\u8def"},{"a":273,"b":274,"t":"street","name":"\u6717\u65e5\u8def"},{"a":274,"b":275,"t":"street","name":"\u6717\u65e5\u8def"},{"a":275,"b":276,"t":"street","name":"\u6717\u65e5\u8def"},{"a":276,"b":277,"t":"street","name":"\u6717\u65e5\u8def"},{"a":273,"b":278,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":278,"b":279,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":279,"b":280,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":280,"b":254,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":277,"b":281,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":281,"b":282,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":282,"b":283,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":283,"b":258,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":254,"b":284,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":284,"b":285,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":285,"b":286,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":286,"b":287,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":258,"b":288,"t":"street","name":"\u99ac\u7530\u8def"},{"a":288,"b":289,"t":"street","name":"\u99ac\u7530\u8def"},{"a":289,"b":290,"t":"street","name":"\u99ac\u7530\u8def"},{"a":290,"b":291,"t":"street","name":"\u99ac\u7530\u8def"},{"a":287,"b":292,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":292,"b":293,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":293,"b":294,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":294,"b":291,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":291,"b":295,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":295,"b":296,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":296,"b":297,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":297,"b":298,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":262,"b":299,"t":"street","name":"\u6771\u5824\u8857"},{"a":299,"b":300,"t":"street","name":"\u6771\u5824\u8857"},{"a":300,"b":301,"t":"street","name":"\u6771\u5824\u8857"},{"a":301,"b":298,"t":"street","name":"\u6771\u5824\u8857"}],"river":[[177.6,-579.2],[176.6,-576.1],[174.7,-570.1],[171.8,-560.9],[167.9,-548.7],[163.1,-533.5],[157.3,-515.1],[150.5,-493.8],[142.7,-469.4],[135.4,-445.3],[128.5,-421.4],[122.0,-397.8],[115.9,-374.5],[110.2,-351.4],[104.9,-328.6],[100.0,-306.1],[95.6,-283.9],[91.0,-262.3],[86.3,-241.5],[81.4,-221.3],[76.4,-201.9],[71.3,-183.1],[66.0,-165.1],[60.6,-147.7],[55.0,-131.1],[49.3,-115.1],[43.5,-99.9],[37.5,-85.3],[31.4,-71.4],[25.1,-58.2],[18.7,-45.7],[12.2,-34.0],[5.5,-22.9],[-1.0,-11.8],[-7.1,-0.7],[-13.0,10.5],[-18.5,21.6],[-23.8,32.6],[-28.8,43.8],[-33.6,54.9],[-38.0,66.0],[-42.5,78.4],[-46.9,92.3],[-51.4,107.6],[-55.8,124.3],[-60.3,142.4],[-64.7,161.8],[-69.2,182.7],[-73.6,204.9],[-78.1,226.5],[-82.5,247.3],[-86.9,267.5],[-91.4,286.9],[-95.8,305.7],[-100.2,323.7],[-104.6,341.1],[-109.0,357.7],[-113.2,373.6],[-117.1,388.7],[-120.7,403.1],[-124.2,416.6],[-127.3,429.4],[-130.3,441.5],[-133.0,452.8],[-135.4,463.2],[-137.6,472.4],[-139.4,480.3],[-140.9,486.9],[-142.2,492.1],[-143.1,496.1],[-143.7,498.7],[-144.0,500.0]],"lake":[[-68.0,328.0],[-66.8,327.5],[-64.2,326.5],[-60.5,325.0],[-55.5,323.0],[-51.0,322.5],[-47.0,323.5],[-43.5,326.0],[-40.5,330.0],[-38.5,334.5],[-37.5,339.5],[-37.5,345.0],[-38.5,351.0],[-40.5,356.2],[-43.5,360.8],[-47.5,364.5],[-52.5,367.5],[-57.5,369.0],[-62.5,369.0],[-67.5,367.5],[-72.5,364.5],[-76.2,361.0],[-78.8,357.0],[-80.0,352.5],[-80.0,347.5],[-79.2,343.0],[-77.8,339.0],[-75.5,335.5],[-72.5,332.5],[-70.2,330.2],[-68.8,328.8],[-68.0,328.0]],"bounds":[-256.0,-1136.0,920.0,472.0],"J":{"W0":0,"W1":4,"W2":10,"W3":14,"W4":18,"W5":22,"W6":25,"H1":31,"HOSP":35,"Q0":36,"H0":44,"Q4":50,"S0":54,"N0":65,"K0":69,"E1":76,"E0":77,"E2":93,"E3":97,"E4":102,"E5":106,"E6":108,"B0":109,"B2":119,"B3":121,"N1":125,"C1":132,"D1":134,"F0":138,"N9":140,"C2":142,"D2":144,"F1":148,"T0":172,"YW":183,"TS0":197,"TW1":198,"TE1":205,"TC":209,"TN":213,"TW2":214,"TE2":221,"TW3":222,"TE3":229,"TH":244,"YN0":250,"YM1":254,"YM2":258,"YE":262,"POK":266,"YN1":273,"YN2":277,"YS1":287,"YS2":291,"YS3":298}};
const WD={main:16,avenue:26,street:12};
const [LB0,LB1,LB2,LB3]=LAY.bounds; const BX0=LB0-8, BZ0=LB1-8, BX1=LB2+8, BZ1=LB3+8;
const MAP={nodes:LAY.nodes,roads:[],crossings:[],blds:[],parks:[],water:[],poi:{},bounds:[BX0,BZ0,BX1,BZ1]}; window.MAP=MAP;
const NODES=MAP.nodes, ADJ=NODES.map(()=>[]), EDGE={};
const RIV=LAY.river, RIVH=REGION==='st'?36:13; const ELEVR=['元朗公路','天水圍路'];
function segDist(px,pz,A,B){ const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; let t=((px-A[0])*dx+(pz-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); return Math.hypot(A[0]+dx*t-px,A[1]+dz*t-pz); }
function riverDist(x,z){ let d=1e9; for(let i=1;i<RIV.length;i++) d=Math.min(d,segDist(x,z,RIV[i-1],RIV[i])); return d; }
LAY.edges.forEach(e=>{ const A=NODES[e.a], B=NODES[e.b]; const w=WD[e.t];
  let bridge=false; for(let q=0;q<=10;q++){ if(riverDist(A[0]+(B[0]-A[0])*q/10,A[1]+(B[1]-A[1])*q/10)<RIVH+2){ bridge=true; break; } }
  const r={n:[e.a,e.b],w,t:e.t,name:e.name,bridge,elev:ELEVR.includes(e.name)}; MAP.roads.push(r); const L=Math.hypot(B[0]-A[0],B[1]-A[1]);
  ADJ[e.a].push([e.b,L,r]); ADJ[e.b].push([e.a,L,r]); EDGE[e.a+'-'+e.b]=EDGE[e.b+'-'+e.a]=r; });
const DEG=ADJ.map(a=>a.length);
/* ---------- 元朗公路高架：由 E0 到元朗，兩頭上落斜，中間約 8 米高 ---------- */
// 高架路：元朗公路（兩頭上落斜）、天水圍路（由元朗公路分支，喺天水圍落斜）
function mkElev(st,en,name,rampA){ const E=NODES[en]; let cur=st, prev=-1; const seq=[st];
  for(let g=0;g<300&&cur!==en;g++){ const c=ADJ[cur].filter(([o,,r])=>r.name===name&&o!==prev); if(!c.length) break;
    const dd=k=>Math.hypot(NODES[k][0]-E[0],NODES[k][1]-E[1]); c.sort((p,q)=>dd(p[0])-dd(q[0])); prev=cur; cur=c[0][0]; seq.push(cur); }
  const pts=seq.map(k=>NODES[k]); const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const L=cum[cum.length-1], H=8, s0=30, R=75; const hAt=s=>{ const u=Math.min(rampA?(s-s0)/R:9,(L-s0-s)/R); if(u<=0) return 0; if(u>=1) return H; return H*u*u*(3-2*u); };
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; pts.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  return {seq,pts,cum,L,H,hAt,bb:[x0-30,z0-30,x1+30,z1+30],rad:12.4}; }
const HWS=REGION==='tm'?[mkElev(LAY.J.E0,LAY.J.YW,'元朗公路',true),mkElev(LAY.J.T0,LAY.J.TS0,'天水圍路',false)]:[];
function elev1(T,x,z,rad){ const b=T.bb; if(x<b[0]||x>b[2]||z<b[1]||z>b[3]) return 0; rad=rad||T.rad; let best=1e9,bs=0;
  for(let i=1;i<T.pts.length;i++){ const A=T.pts[i-1],B=T.pts[i], dx=B[0]-A[0], dz=B[1]-A[1], L2=dx*dx+dz*dz||1; let t=((x-A[0])*dx+(z-A[1])*dz)/L2; t=t<0?0:t>1?1:t;
    const ex=x-A[0]-dx*t, ez=z-A[1]-dz*t, d=ex*ex+ez*ez; if(d<best){ best=d; bs=T.cum[i-1]+t*(T.cum[i]-T.cum[i-1]); } }
  return best<=rad*rad?T.hAt(bs):0; }
function ELEV(x,z,rad){ let m=0; for(const T of HWS){ const a=elev1(T,x,z,rad); if(a>m) m=a; } return m; }
window.ELEV=ELEV;
const inTSW=(x,z)=>REGION==='tm'&&x>120&&x<425&&z<-835&&z>-1085;   // 天水圍市區
const rural=(x,z)=>REGION==='st'?false:!inTSW(x,z)&&!(x<240&&z>-440)&&!(x>430&&z<-540);   // 屯門、元朗、天水圍市區以外：郊區
let northWild=(x,z)=>REGION==='tm'&&z<-840&&!inTSW(x,z);   // 新加嘅北面（天水圍以外）：魚塘同濕地，唔起樓
const SIGNAL=DEG.map((d,k)=>d>=3&&ELEV(NODES[k][0],NODES[k][1])<0.5);
const CLR=ADJ.map((a,k)=>DEG[k]>=3?Math.max(...a.map(e=>e[2].w/2))+1.5:0);   // 路口半徑（停車線之前）
const NW=ADJ.map(a=>Math.max(...a.map(e=>e[2].w/2)));                        // 路口填色半徑
const angOf=(A,B)=>Math.atan2(B[0]-A[0],B[1]-A[1]);
const REF=ADJ.map((a,k)=>a.length?angOf(NODES[k],NODES[a[0][0]]):0);

/* ---------- 格網：1 路、2 建築、4 水、8 預留、16 行人路 ---------- */
const X0=BX0-60,Z0=BZ0-60, CELL=2, GW=Math.ceil((BX1+60-X0)/CELL), GH=Math.ceil((BZ1+60-Z0)/CELL);
const grid=new Uint8Array(GW*GH);
const gi=(x,z)=>{const i=Math.floor((x-X0)/CELL), j=Math.floor((z-Z0)/CELL); return (i<0||j<0||i>=GW||j>=GH)?-1:j*GW+i;};
const cellAt=(x,z)=>{const k=gi(x,z); return k<0?2:grid[k];};
function markSeg(A,B,w,bit,clear=0){ const r=w/2, minx=Math.min(A[0],B[0])-r, maxx=Math.max(A[0],B[0])+r, minz=Math.min(A[1],B[1])-r, maxz=Math.max(A[1],B[1])+r;
  for(let z=minz;z<=maxz+CELL;z+=CELL) for(let x=minx;x<=maxx+CELL;x+=CELL){ const cx=Math.floor((x-X0)/CELL)*CELL+X0+1, cz=Math.floor((z-Z0)/CELL)*CELL+Z0+1;
    if(segDist(cx,cz,A,B)<=r){ const k=gi(cx,cz); if(k>=0){ grid[k]&=~clear; grid[k]|=bit; } } } }
function inQuad(x,z,c){ let s=0; for(let i=0;i<4;i++){ const A=c[i],B=c[(i+1)%4]; const cr=(B[0]-A[0])*(z-A[1])-(B[1]-A[1])*(x-A[0]); if(cr>0) s|=1; else if(cr<0) s|=2; } return s!==3; }
function quadCells(c,fn,margin=0){ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; c.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  const cx=(c[0][0]+c[2][0])/2, cz=(c[0][1]+c[2][1])/2; const cc=margin?c.map(([x,z])=>{ const dx=x-cx,dz=z-cz,L=Math.hypot(dx,dz)||1; return [x+dx/L*margin,z+dz/L*margin]; }):c;
  for(let z=z0-margin;z<=z1+margin;z+=CELL/2) for(let x=x0-margin;x<=x1+margin;x+=CELL/2) if(inQuad(x,z,cc)){ if(fn(gi(x,z))===false) return false; } return true; }
const quadFree=(c,margin=1)=>quadCells(c,k=>!(k<0||grid[k]),margin);
const markQuad=(c,bit)=>quadCells(c,k=>{ if(k>=0) grid[k]|=bit; });
// 邊界外面當障礙
for(let j=0;j<GH;j++) for(let i=0;i<GW;i++){ const x=X0+i*CELL+1, z=Z0+j*CELL+1; if(x<BX0||x>BX1||z<BZ0||z>BZ1) grid[j*GW+i]|=2; }
// 河
for(let i=1;i<RIV.length;i++) markSeg(RIV[i-1],RIV[i],RIVH*2,4);
// 湖（公園）
const LAKE=LAY.lake; { let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; LAKE.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  const inP=(x,z)=>{let c=false;for(let i=0,j=LAKE.length-1;i<LAKE.length;j=i++){const [xi,zi]=LAKE[i],[xj,zj]=LAKE[j]; if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
  for(let z=z0;z<=z1;z+=CELL) for(let x=x0;x<=x1;x+=CELL) if(inP(x,z)){ const k=gi(x,z); if(k>=0) grid[k]|=4; } }
// 行人路、路面
MAP.roads.forEach(r=>{ const A=NODES[r.n[0]],B=NODES[r.n[1]]; if(!r.bridge) markSeg(A,B,r.w+7.2,16); });
NODES.forEach((N,k)=>{ if(DEG[k]) markSeg(N,N,(NW[k]+3.6)*2,16); });
MAP.roads.forEach(r=>{ const A=NODES[r.n[0]],B=NODES[r.n[1]]; markSeg(A,B,r.w,1,4|16); });
NODES.forEach((N,k)=>{ if(DEG[k]) markSeg(N,N,NW[k]*2,1,4|16); });

/* ---------- 地面、河、路 ---------- */
{ const g=add(new THREE.PlaneGeometry(BX1-BX0+900,BZ1-BZ0+900),M(0xcfe6b8,{r:0.95}),scene,(BX0+BX1)/2,-0.05,(BZ0+BZ1)/2,false); g.rotation.x=-Math.PI/2; }
{ const bank=[], water=[]; for(let i=1;i<RIV.length;i++){ ribbon(bank,RIV[i-1],RIV[i],RIVH+4); ribbon(water,RIV[i-1],RIV[i],RIVH); }
  RIV.forEach(p=>{ disc(bank,p,RIVH+4,12); disc(water,p,RIVH,12); });
  flat(bank,M(0xb9c7a8,{r:0.95}),0.0); flat(water,M(0x6cc2ec,{r:0.25}),0.03);
  const lake=[]; for(let i=1;i<LAKE.length-1;i++) lake.push(LAKE[0][0],0,LAKE[0][1], LAKE[i][0],0,LAKE[i][1], LAKE[i+1][0],0,LAKE[i+1][1]); flat(lake,M(0x7ec8f0,{r:0.3}),0.2);
  // 小地圖用：河嘅多邊形
  const Lp=[],Rp=[]; for(let i=0;i<RIV.length;i++){ const A=RIV[Math.max(0,i-1)],B=RIV[Math.min(RIV.length-1,i+1)]; const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1;
    Lp.push([RIV[i][0]+dz/L*RIVH,RIV[i][1]-dx/L*RIVH]); Rp.push([RIV[i][0]-dz/L*RIVH,RIV[i][1]+dx/L*RIVH]); }
  MAP.water.push([...Lp,...Rp.reverse()], LAKE); }
// 高架路：路面切成 4 米一段，跟住斜坡弧度；斜坡上嘅節點唔畫圓盤（否則圓盤邊會凸出路面）
const dirn=(A,B)=>{ const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1; return [dx/L,dz/L,L]; };
const onRamp=k=>ADJ[k].some(e=>e[2].elev)&&(h=>h>0.03&&h<7.97)(ELEV(NODES[k][0],NODES[k][1]));
function elevPieces(A,B,step,fn){ const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1, n=Math.max(1,Math.ceil(L/step));
  for(let i=0;i<n;i++){ const t0=i/n, t1=(i+1)/n; fn([A[0]+dx*t0,A[1]+dz*t0],[A[0]+dx*t1,A[1]+dz*t1],i,n,L/n); } }
{ const walk=[], road=[]; MAP.roads.forEach(r=>{ const A=NODES[r.n[0]],B=NODES[r.n[1]];
    if(!r.elev){ ribbon(walk,A,B,r.w/2+3.6); ribbon(road,A,B,r.w/2); return; }
    const [ux,uz]=dirn(A,B); elevPieces(A,B,4,(P,Q,i,n)=>{ const e0=i===0?0.6:0, e1=i===n-1?0.6:0; const P2=[P[0]-ux*e0,P[1]-uz*e0], Q2=[Q[0]+ux*e1,Q[1]+uz*e1];
      ribbon(walk,P2,Q2,r.w/2+3.6); ribbon(road,P2,Q2,r.w/2); }); });
  NODES.forEach((N,k)=>{ if(!DEG[k]||onRamp(k)) return; disc(walk,N,NW[k]+3.6,20); disc(road,N,NW[k],20); });
  flat(walk,new THREE.MeshStandardMaterial({map:walkTex,roughness:0.9}),0.10); flat(road,M(C.road,{r:0.85}),0.14); }
// 標線、斑馬線、輕鐵路軌
const mW=[], mY=[], mR=[];
MAP.roads.forEach(r=>{ const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B); const nx=uz, nz=-ux;
  const s0=DEG[a]>=3?CLR[a]+4.5:0, s1=L-(DEG[b]>=3?CLR[b]+4.5:0);
  const P=s=>[A[0]+ux*s,A[1]+uz*s];
  const line=(arr,o,hw,dash)=>{ const solid=r.elev?4:1e9; for(let s=s0;s<s1-0.5;s+=dash?8:solid){ const e=Math.min(s1,s+(dash?4:solid)); const p=P(s), q=P(e);
      arr.push(p[0]+nx*(o+hw),0,p[1]+nz*(o+hw), q[0]+nx*(o+hw),0,q[1]+nz*(o+hw), q[0]+nx*(o-hw),0,q[1]+nz*(o-hw),  p[0]+nx*(o+hw),0,p[1]+nz*(o+hw), q[0]+nx*(o-hw),0,q[1]+nz*(o-hw), p[0]+nx*(o-hw),0,p[1]+nz*(o-hw)); } };
  if(REGION==='st'){ // 沙田冇輕鐵：用返正常分隔線——中間雙黃線、行車線虛線、路邊白實線
    const ew=r.w/2-0.6;
    if(r.t==='avenue'){ line(mY,0.3,0.12,false); line(mY,-0.3,0.12,false); line(mW,6.5,0.12,true); line(mW,-6.5,0.12,true); }
    else if(r.t==='main'){ line(mY,0.25,0.12,false); line(mY,-0.25,0.12,false); }
    else line(mW,0,0.13,true);
    if(!r.bridge||r.t!=='street'){ line(mW,ew,0.1,false); line(mW,-ew,0.1,false); } }
  else {
  if(r.t==='avenue'){ line(mY,6.1,0.15,false); line(mY,-6.1,0.15,false);
    [-3.2,3.2].forEach(o=>[-0.7,0.7].forEach(q=>{ const p=A,q2=B; mR.push(p[0]+nx*(o+q+0.1),0,p[1]+nz*(o+q+0.1), q2[0]+nx*(o+q+0.1),0,q2[1]+nz*(o+q+0.1), q2[0]+nx*(o+q-0.1),0,q2[1]+nz*(o+q-0.1), p[0]+nx*(o+q+0.1),0,p[1]+nz*(o+q+0.1), q2[0]+nx*(o+q-0.1),0,q2[1]+nz*(o+q-0.1), p[0]+nx*(o+q-0.1),0,p[1]+nz*(o+q-0.1)); })); }
  else line(r.t==='main'?mY:mW,0,0.18,r.t!=='main');
  }
  // 斑馬線：喺有燈路口嘅每條入口
  [[a,0,1],[b,L,-1]].forEach(([k,sb,sg])=>{ if(!SIGNAL[k]) return; const s=sb+sg*(CLR[k]+0.6), s2=s+sg*3; const hw=r.w/2;
    for(let o=-hw+0.9;o<=hw-0.9;o+=1.6){ const p=P(s), q=P(s2); quadA(mW,[[p[0]+nx*(o-0.5),p[1]+nz*(o-0.5)],[q[0]+nx*(o-0.5),q[1]+nz*(o-0.5)],[q[0]+nx*(o+0.5),q[1]+nz*(o+0.5)],[p[0]+nx*(o+0.5),p[1]+nz*(o+0.5)]]); }
    const m=P(s+sg*1.5); MAP.crossings.push({p:m,n:[nx,nz],half:hw+2.6,node:k,ang:Math.atan2(ux,uz)}); });
});
flat(mW,new THREE.MeshBasicMaterial({color:0xffffff}),0.17); flat(mY,new THREE.MeshBasicMaterial({color:0xffd23f}),0.17); flat(mR,new THREE.MeshBasicMaterial({color:0x50535a}),0.18);
// 橋欄杆
// 只喺真正跨過河嘅位置起欄杆，而且唔會伸入其他馬路
const railMat=M(0xf1f3f5);
MAP.roads.forEach(r=>{ if(!r.bridge) return; const A=NODES[r.n[0]],B=NODES[r.n[1]]; const [ux,uz,L]=dirn(A,B);
  [-1,1].forEach(sd=>{ const o=(r.w/2+3.4)*sd; let run=null; const flush=()=>{ if(run&&run[1]-run[0]>=2){ const s0=run[0],s1=run[1], m=add(new THREE.BoxGeometry(0.45,1.1,s1-s0),railMat,scene,A[0]+ux*(s0+s1)/2+uz*o,0.7,A[1]+uz*(s0+s1)/2-ux*o,true); m.rotation.y=Math.atan2(ux,uz); } run=null; };
    for(let s=0;s<=L;s+=1){ const x=A[0]+ux*s+uz*o, z=A[1]+uz*s-ux*o; const ok=!(cellAt(x,z)&1)&&riverDist(x,z)<RIVH+5&&!(cellAt(x+ux*1.5,z+uz*1.5)&1)&&!(cellAt(x-ux*1.5,z-uz*1.5)&1);
      if(ok){ if(!run) run=[s,s]; run[1]=s+1; } else flush(); } flush(); }); });

/* ---------- 地標 ---------- */
// 高架橋身：橋面、兩邊石壆、橋躉（建好之後一齊抬高）
{ const deck=M(0xb9bec6,{r:0.9}), side=M(0x9aa1ab,{r:0.9}), par=M(0xe3e6ea,{r:0.8}), hw=8+3.6;
  const lineDist=(T,x,z)=>{ let d=1e9; for(let i=1;i<T.pts.length;i++) d=Math.min(d,segDist(x,z,T.pts[i-1],T.pts[i])); return d; };
  for(const T of HWS){ const others=HWS.filter(o=>o!==T);
   for(let i=1;i<T.pts.length;i++){ const A=T.pts[i-1],B=T.pts[i]; const h=Math.max(T.hAt(T.cum[i-1]),T.hAt(T.cum[i])); if(h<0.3) continue;
    const [ux,uz,L]=dirn(A,B); const nx=uz, nz=-ux;
    // 4 米一段：橋面同石壆跟住斜坡；分叉位嘅石壆如果伸入另一條高架路面就唔起
    elevPieces(A,B,4,(P0,Q0,k,n,len)=>{ const P=(s,o)=>[P0[0]+ux*s+nx*o,P0[1]+uz*s+nz*o];
      boxQ([P(0,-hw),P(len,-hw),P(len,hw),P(0,hw)],-1.5,0.04,side,deck,8,3);
      [-1,1].forEach(sd=>{ const o=sd*(hw+0.2), m=P(len/2,o); if(others.some(O=>lineDist(O,m[0],m[1])<hw+0.6)) return;
        boxQ([P(0,o-0.35),P(len,o-0.35),P(len,o+0.35),P(0,o+0.35)],0.2,1.4,par,par,8,3); }); });
    const Pm=(s,o)=>[A[0]+ux*s+nx*o,A[1]+uz*s+nz*o];
    const hm=T.hAt(T.cum[i-1]+L/2); if(hm>3) for(const o of [-5,5]) boxQ([Pm(L/2-1.3,o-1.3),Pm(L/2+1.3,o-1.3),Pm(L/2+1.3,o+1.3),Pm(L/2-1.3,o+1.3)],-hm,-1.5,side,side,4,4); } } }
const props={tree:[],lamp:[],rail:[],bin:[]}; const signs=[]; const parked=[];
function labelPlane(text,x,y,z,ry,bg,w=14,parent=scene){ const t=canvasTex(512,128,(g)=>{ g.fillStyle=bg; rr(g,4,4,504,120,24); g.fill(); g.fillStyle='#fff'; g.font='bold 72px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,256,68); },false);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshBasicMaterial({map:t})); m.position.set(x,y,z); m.rotation.y=ry; parent.add(m); return m; }
function addBldQ(c,h,lm){ MAP.blds.push({p:c,h,lm}); markQuad(c,2); }
// 搵最近（唔係橋）嘅路段
function nearestEdge(x,z,filter){ let best=null; MAP.roads.forEach(r=>{ if(r.bridge||(filter&&!filter(r))) return; const A=NODES[r.n[0]],B=NODES[r.n[1]]; const d=segDist(x,z,A,B); if(!best||d<best.d) best={r,d}; });
  const r=best.r, A=NODES[r.n[0]],B=NODES[r.n[1]]; const [ux,uz,L]=dirn(A,B); let t=((x-A[0])*ux+(z-A[1])*uz); t=Math.max(6,Math.min(L-6,t));
  const R=[A[0]+ux*t,A[1]+uz*t]; let nx=uz, nz=-ux; if((x-R[0])*nx+(z-R[1])*nz<0){ nx=-nx; nz=-nz; } return {r,R,nx,nz}; }
// 地標框：原點喺行人路後面，+z（局部）= 遠離馬路，+x（局部）= (nz,-nx)
function frameAt(R,nx,nz,off){ const F=[R[0]+nx*off,R[1]+nz*off], ux=nz, uz=-nx; const L=(lx,lz)=>[F[0]+ux*lx+nx*lz,F[1]+uz*lx+nz*lz];
  const g=new THREE.Group(); g.position.set(F[0],0,F[1]); g.rotation.y=Math.atan2(nx,nz); scene.add(g);
  const rq=(x0,z0,x1,z1)=>[L(x0,z0),L(x1,z0),L(x1,z1),L(x0,z1)]; return {F,L,g,rq,nx,nz,ux,uz,off}; }
function placeLM(px,pz,w,d,filter){ // 沿住條路前後試位置，直到成塊地唔壓到其他馬路、河或者其他地標
  let E0=nearestEdge(px,pz,filter), pick0=null;
  for(const k of [0,8,-8,16,-16,24,-24,32,-32,44,-44,56,-56]){ const ux=E0.nz, uz=-E0.nx; const E=nearestEdge(px-ux*k,pz-uz*k,filter); const off=E.r.w/2+3.6+0.4;
    const F=[E.R[0]+E.nx*off,E.R[1]+E.nz*off], Lx=(lx,lz)=>[F[0]+E.nz*lx+E.nx*lz,F[1]-E.nx*lx+E.nz*lz];
    const ok=quadCells([Lx(-w/2,1),Lx(w/2,1),Lx(w/2,d),Lx(-w/2,d)],q=>!(q<0||(grid[q]&(1|4|8))));
    if(ok){ pick0=E; break; } }
  if(!pick0) console.warn('placeLM: 搵唔到空位',px,pz);
  const E=pick0||E0; const off=E.r.w/2+3.6+0.4; const f=frameAt(E.R,E.nx,E.nz,off); f.E=E;
  markQuad(f.rq(-w/2-2,-2,w/2+2,d+2),8); boxQ(f.rq(-w/2,0,w/2,d),0,0.32,lotMat,lotMat); return f; }
// 停車位：喺地標嗰邊嘅行車線
const laneOff=r=>r.t==='avenue'?8.6:r.w/4;
function curbStop(f,lx){ const o=f.off-laneOff(f.E.r); return f.L(lx,-o); }
const LMK={};
const S2=LAY.S; const RP=(x,z)=>[x*S2,z*S2]; // 真實坐標 → 遊戲坐標

// 醫院：喺路盡頭（屯門醫院：青松觀路北；博愛醫院：坳頭路）
function buildHosp(key,name,c1,c2){ const k=LAY.J[key], N=NODES[k], P0=NODES[ADJ[k][0][0]]; const [dx,dz]=dirn(P0,N); const f=frameAt(N,dx,dz,4);
  const w=120,d=80; markQuad(f.rq(-w/2-2,-4,w/2+2,d+2),8); boxQ(f.rq(-w/2,0,w/2,d),0,0.3,walkMat,walkMat);
  markQuad(f.rq(-16,-4,16,26),1);  // 車道當路面
  boxQ(f.rq(-16,0,16,26),0,0.33,M(0xa9b0ba,{r:0.9}),M(0xa9b0ba,{r:0.9}));
  const hm=texMat('hosp'+key,housingTex(c1[0],c1[1],2)), hm2=texMat('hosp2'+key,housingTex(c2[0],c2[1],1));
  let c=f.rq(-50,26,50,40); boxQ(c,0.3,12,hm2,M(0xd62839),8,3); addBldQ(c,12,'hospital');
  c=f.rq(-54,44,-6,76); boxQ(c,0.3,34,hm,roofMat,8,3); addBldQ(c,34,'hospital');
  c=f.rq(4,46,54,76); boxQ(c,0.3,26,hm,roofMat,8,3); addBldQ(c,26,'hospital');
  add(new THREE.CylinderGeometry(8,8,0.4,32),M(0x58606b),f.g,-30,34.5,60,false);
  labelPlane('H',-30,34.75,60,0,'#58606b',9,f.g).rotation.x=-Math.PI/2;
  labelPlane(name,-30,22,43.9,Math.PI,'#d62839',22,f.g);
  add(new THREE.BoxGeometry(26,0.6,11),M(0x8fd3c7),f.g,0,5.2,20.5,true);
  [-12,12].forEach(o=>add(new THREE.CylinderGeometry(0.35,0.35,5,10),M(0xd0d4da),f.g,o,2.6,15.5,true));
  labelPlane('急症室 A&E',0,8.4,25.9,Math.PI,'#d62839',18,f.g);
  MAP.poi.ae=(MAP.poi.ae||[]).concat([f.L(0,26)]);
  return {door:f.L(0,24.5),stop:f.L(0,13),poi:f.L(0,50)};
}
if(REGION==='tm'){ LMK.ae=buildHosp('HOSP','屯門醫院',['#e3f4f1','#2a9d8f'],['#fde8e8','#d62839']); MAP.poi.hospital=LMK.ae.poi;
LMK.ae2=buildHosp('POK','博愛醫院',['#f3efe6','#b5651d'],['#fff1e0','#c0392b']); MAP.poi.hospital2=LMK.ae2.poi; }
// 救護站（屯門：震寰路；元朗：擊壤路）
function buildDepot(f,zh,en,addr,key){
  // 外觀跟真實屯門救護站：米色混凝土平房、紅色摺門、紅字招牌、門柱黃黑間條、射燈
  const dm=texMat('depot'+key,canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); g.fillStyle='rgba(120,110,90,.10)'; for(let i=0;i<14;i++) g.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*30,1+Math.random()*3);
    g.fillStyle='#c9c0a8'; g.fillRect(0,0,w,6); }));
  const roofM=M(0xbdb5a0,{r:0.95}), H=8;
  const BX=-5.4, B0=BX-4.4, B1=BX+4.4;
  [[-26,16,B0,38],[B1,16,26,38],[B0,33,B1,38]].forEach(([a,b,cc,d])=>{ const q=f.rq(a,b,cc,d); boxQ(q,0.3,H,dm,roofM,8,4); addBldQ(q,H,'depot'); });
  boxQ(f.rq(B0,16,B1,33),6.4,H,dm,roofM,8,4);                            // 車房門頂
  boxQ(f.rq(B0,16,B1,33),0.3,0.34,M(0x8a4b3a),M(0x8a4b3a));              // 車房地台（紅啡色）
  { const pl=new THREE.PointLight(0xfff2cc,0.6,14); pl.position.set(BX,5.5,24); f.g.add(pl); }
  boxQ(f.rq(-26.3,15.7,26.3,38.3),H,H+0.5,dm,roofM,8,4);                 // 天台矮牆
  // 紅色摺門
  const doorT=canvasTex(256,192,(g,w,h)=>{ for(let i=0;i<16;i++){ g.fillStyle=i%2?'#b8434f':'#c95560'; g.fillRect(i*16,0,16,h); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(i*16+14,0,2,h); }
    g.fillStyle='#ffffff'; g.font='bold 18px sans-serif'; g.textAlign='center'; g.fillText('CAUTION FOLDING DOOR',w/2,112); g.font='bold 26px sans-serif'; g.fillText('小心摺門',w/2,146); },false);
  const doorM=new THREE.MeshStandardMaterial({map:doorT,roughness:0.7});
  const hazT=canvasTex(32,128,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); for(let i=0;i<8;i++){ g.fillStyle=i%2?'#1c1c1c':'#f2c200'; g.fillRect(10,64+i*8,12,8); } },false);
  const pilM=new THREE.MeshStandardMaterial({map:hazT,roughness:0.9});
  for(let k=0;k<4;k++){ const x=-16+k*10.6; if(Math.abs(x-BX)<1){ // 打開咗嗰個車位：摺門摺埋喺兩邊
      [-1,1].forEach(s=>add(new THREE.BoxGeometry(1.0,6.1,0.9),M(0xb8434f),f.g,x+s*3.7,3.35,16.6,false)); continue; }
    const d=new THREE.Mesh(new THREE.PlaneGeometry(8.6,6.1),doorM); d.position.set(x,3.35,15.92); d.rotation.y=Math.PI; f.g.add(d); }
  for(let k=0;k<5;k++){ const x=-21.3+k*10.6; add(new THREE.BoxGeometry(1.6,6.4,0.6),dm,f.g,x,3.5,15.7,true);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(1.6,6.4),pilM); p.position.set(x,3.5,15.38); p.rotation.y=Math.PI; f.g.add(p); }
  // 招牌：米色牆身上嘅紅字
  { const t=canvasTex(1024,128,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); g.fillStyle='#c4202f'; g.textAlign='center'; g.textBaseline='middle';
      g.font='bold 54px sans-serif'; g.fillText(zh,w/2,34); g.font='bold '+(en.length>24?44:50)+'px sans-serif'; g.fillText(en,w/2,96); },false);
    const s=new THREE.Mesh(new THREE.PlaneGeometry(17,2.1),new THREE.MeshStandardMaterial({map:t,roughness:0.9})); s.position.set(-2,7.45,15.66); s.rotation.y=Math.PI; f.g.add(s);
    const t2=canvasTex(256,32,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); g.fillStyle='#c4202f'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(addr,w/2,17); },false);
    const s2=new THREE.Mesh(new THREE.PlaneGeometry(8,1),new THREE.MeshStandardMaterial({map:t2})); s2.position.set(16,7.6,15.66); s2.rotation.y=Math.PI; f.g.add(s2); }
  // 射燈
  [12,-8].forEach(x=>{ const l=add(new THREE.BoxGeometry(1.6,0.7,0.9),M(0x8c9196),f.g,x,H+0.9,15.4,false); l.rotation.x=0.5; add(new THREE.BoxGeometry(1.3,0.45,0.05),M(0xfff6d0,{e:0x666655}),f.g,x,H+0.75,14.95,false); });
  // 門口盆栽
  for(let k=0;k<4;k++){ add(new THREE.CylinderGeometry(0.9,0.7,0.8,10),M(0xd8cfc2),f.g,-24+k*1.9,0.75,10,false); add(new THREE.SphereGeometry(1.1,8,6),M(0x4f9a45),f.g,-24+k*1.9,1.9,10,false); }
  markSeg(f.L(-21,10),f.L(-18.3,10),2.4,2);
  const face=Math.atan2(-f.nx,-f.nz);
  return {pos:f.L(BX,25),a:face,face,f}; }   // 開波時喺車房入面，車頭向住馬路
if(REGION==='tm'){   // ===== 屯門、元朗、天水圍地標 =====
{ const f=placeLM(...RP(-450,505),56,40,r=>r.name==='震寰路'); const D=buildDepot(f,'屯 門 救 護 站','TUEN MUN AMBULANCE DEPOT','NO. 1 TSUN WEN ROAD','tm'); const face=D.face;
  LMK.parkedAmb=[[f.L(10,7),face],[f.L(21,7),face]];
  LMK.parkedAmb.forEach(([p])=>markSeg(p,p,6,2));
  LMK.depot={pos:D.pos,a:D.a};
  MAP.poi.depot=f.L(0,20);
  // 隔籬消防局
  const g=placeLM(...RP(-450,330),44,36,r=>r.name==='震寰路');
  const fm=texMat('fire',canvasTex(256,96,(g2,w,h)=>{ g2.fillStyle='#ffd9cf'; g2.fillRect(0,0,w,h); g2.fillStyle='#c1121f'; g2.fillRect(0,h-16,w,16); g2.fillStyle='#8fb8d8'; g2.fillRect(30,20,70,40); g2.fillRect(156,20,70,40); }));
  let c2=g.rq(-20,8,20,34); boxQ(c2,0.3,14,fm,M(0xc1121f),8,3); addBldQ(c2,14); c2=g.rq(12,22,20,32); boxQ(c2,14,30,fm,M(0xc1121f),8,3);
  for(let k=0;k<3;k++) add(new THREE.BoxGeometry(9,6.4,0.3),M(0xc1121f),g.g,-12+k*12,3.4,7.85,false);
  labelPlane('消防局',0,10.5,7.7,Math.PI,'#c1121f',14,g.g);
}
// 屯門站（杯渡路北面，河西）
{ const f=placeLM(...RP(-80,560),40,24,r=>r.name==='杯渡路');
  const sm=texMat('stn',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#cfe6f7'; g.fillRect(0,0,w,h); g.fillStyle='#2f8fd8'; g.fillRect(0,h-20,w,20); g.fillStyle='#9cc9e6'; g.fillRect(10,14,236,46); }));
  const c=f.rq(-19,3,19,22); boxQ(c,0.3,16,sm,M(0x2f8fd8),16,6); addBldQ(c,16,'station');
  boxQ(f.rq(-21,6,21,19),16,17.2,roofMat,M(0x2f8fd8));
  labelPlane('屯門站',0,11,2.9,Math.PI,'#2f8fd8',14,f.g);
  LMK.station={patient:f.L(-9,-2.2),stop:curbStop(f,-13)}; }
// 屯門市廣場（屯喜路同青山公路之間）
{ const f=placeLM(...RP(330,760),64,48,r=>r.name==='屯喜路');
  const gm=texMat('plz',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#ffd6a5'; g.fillRect(0,0,w,h); g.fillStyle='#8ecae6'; g.fillRect(0,20,w,64); g.fillStyle='rgba(255,255,255,.45)'; for(let k=0;k<8;k++) g.fillRect(k*32,20,3,64); }));
  let c=f.rq(-30,6,30,46); boxQ(c,0.3,14,gm,M(0xffb366),24,7); addBldQ(c,14,'plaza');
  boxQ(f.rq(-26,12,4,40),14,24,gm,roofMat,24,7); boxQ(f.rq(10,14,26,30),14,44,pick(housingMats),roofMat,8,3);
  labelPlane('屯門市廣場',-12,10.5,5.9,Math.PI,'#f08c2e',24,f.g);
  for(let k=0;k<5;k++) add(new THREE.BoxGeometry(2,5,0.2),M([0xff6b6b,0x4ecdc4,0xffe66d,0x5f27cd][k%4]),f.g,6+k*5,9,5.6,false);
  LMK.plaza={patient:f.L(-12,-2.2),stop:curbStop(f,-4)}; MAP.poi.plaza=f.L(0,24); }
// 屯門大會堂（鄉事會路同屯喜路之間）
{ const f=placeLM(...RP(120,930),48,40,r=>r.name==='屯盛街');
  const tm=texMat('th',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#fff3c4'; g.fillRect(0,0,w,h); g.fillStyle='#d9a400'; for(let k=0;k<6;k++) g.fillRect(k*44+12,10,10,h-20); }));
  const c=f.rq(-22,12,22,38); boxQ(c,0.3,12,tm,M(0xe9c46a),20,8); addBldQ(c,12,'townhall');
  add(new THREE.CylinderGeometry(12,15,6,6),M(0xe9c46a),f.g,0,15,25,true);
  add(new THREE.CylinderGeometry(4,4.4,0.8,24),M(0xb8c4cf),f.g,14,0.7,5,false); add(new THREE.CylinderGeometry(3.4,3.4,0.2,24),M(0x7ec8f0,{e:0x113344}),f.g,14,1.15,5,false); markSeg(f.L(14,5),f.L(14,5),9,2);
  labelPlane('屯門大會堂',-4,9,11.9,Math.PI,'#d9a400',20,f.g);
  LMK.townhall={patient:f.L(-6,-2.2),stop:curbStop(f,2)}; MAP.poi.townhall=f.L(0,24); }
// 屯門公園（鄉事會路西面，有湖）
{ const f=placeLM(...RP(-60,880),56,30,r=>r.t==='avenue');
  boxQ(f.rq(-28,0,28,30),0,0.34,grassMat,grassMat);
  const pav=new THREE.Group(); pav.position.set(14,0.3,16); f.g.add(pav);
  [[-3,-3],[3,-3],[-3,3],[3,3]].forEach(([a,b])=>add(new THREE.CylinderGeometry(0.3,0.3,4,8),M(0xc1121f),pav,a,2,b));
  add(new THREE.ConeGeometry(6,3,4),M(0x2a9d8f),pav,0,5.4,0).rotation.y=Math.PI/4; markSeg(f.L(14,16),f.L(14,16),9,2);
  add(new THREE.BoxGeometry(6,0.3,2),M(0xffd166),f.g,-14,1.6,14,true); add(new THREE.BoxGeometry(0.4,3,0.4),M(0xff6b6b),f.g,-17,1.5,14,true);
  labelPlane('屯門公園',0,4,0.6,Math.PI,'#46a35e',14,f.g);
  LMK.park={patient:f.L(-4,-2.2),stop:curbStop(f,-10)}; MAP.poi.park=f.L(0,15);
  // 湖邊草地
  const L=LAKE; let cx=0,cz=0; L.forEach(([x,z])=>{cx+=x;cz+=z;}); cx/=L.length; cz/=L.length; const gr=[]; disc(gr,[cx,cz],34,24); flat(gr,M(0x9fd77c,{r:0.95}),0.05);
  for(let k=0;k<24;k++){ const a=rnd()*6.28, r=24+rnd()*12; const x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r; if(!(cellAt(x,z)&(1|4|16))){ props.tree.push([x,z,0,0.05]); } }
  for(let z=cz-36;z<=cz+36;z+=CELL) for(let x=cx-36;x<=cx+36;x+=CELL) if(Math.hypot(x-cx,z-cz)<34){ const k=gi(x,z); if(k>=0&&!(grid[k]&(1|16))) grid[k]|=8; }
  MAP.parks.push(f.rq(-28,0,28,30)); }
// 屯門街市（新墟）同學校
{ const f=placeLM(...RP(200,-180),40,28,r=>r.name==='新墟路');
  const c=f.rq(-20,2,20,26); boxQ(c,0.3,10,texMat('mk',shopTex()),M(0x6ab04c),24,4.5); addBldQ(c,10);
  labelPlane('屯門街市',0,8,1.9,Math.PI,'#2b9348',16,f.g);
  LMK.market={patient:f.L(-9,-2.2),stop:curbStop(f,-13)}; }
[[-330,-330,'震寰路'],[150,1000,'屯興路']].forEach(([x,z,nm])=>{ const f=placeLM(...RP(x,z),50,36,r=>r.name===nm);
  boxQ(f.rq(-23,4,4,32),0,0.4,M(0xe9824c),M(0xe9824c));
  const c=f.rq(8,4,24,34); boxQ(c,0.3,16,texMat('sch',housingTex('#dff3c8','#2a9d8f',1)),M(0x2a9d8f),8,3); addBldQ(c,16);
  labelPlane('小學',16,12,3.8,Math.PI,'#2a9d8f',10,f.g); });

/* ---------- 元朗區（簡化）：救護站、博愛醫院（上面）、YOHO Mall＋元朗站、元朗公園、元朗劇院 ---------- */
{ const f=placeLM(...RP(1440,-1590),56,40,r=>r.name==='擊壤路'); const D=buildDepot(f,'元 朗 救 護 站','YUEN LONG AMBULANCE DEPOT','YUEN LONG','yl');
  LMK.depotYL={pos:D.pos,a:D.a}; MAP.poi.depotYL=f.L(0,20); }
// YOHO Mall（形點）：玻璃幕牆商場＋上面住宅
{ const f=placeLM(...RP(1520,-2000),60,44,r=>r.name==='朗日路');
  const gm=texMat('yoho',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#e9eef2'; g.fillRect(0,0,w,h); g.fillStyle='#7fb7d9'; g.fillRect(0,14,w,80); g.fillStyle='rgba(255,255,255,.5)'; for(let k=0;k<10;k++) g.fillRect(k*26,14,3,80); g.fillStyle='#e4572e'; g.fillRect(0,100,w,10); }));
  let c=f.rq(-29,6,29,42); boxQ(c,0.3,15,gm,M(0xd9dee3),24,7); addBldQ(c,15,'plaza');
  [[-20,14],[2,14]].forEach(([x,z])=>{ const q=f.rq(x,z+6,x+16,z+22); boxQ(q,15,58,pick(housingMats),roofMat,8,3); });
  labelPlane('YOHO MALL 形點',-6,10.5,5.9,Math.PI,'#e4572e',26,f.g);
  LMK.yoho={patient:f.L(-12,-2.2),stop:curbStop(f,-4)}; MAP.poi.yoho=f.L(0,24); }
// 元朗站（屯馬綫）
{ const f=placeLM(...RP(1300,-2000),40,26,r=>r.name==='朗日路');
  const sm=texMat('ylstn',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#efe3dc'; g.fillRect(0,0,w,h); g.fillStyle='#9a3b26'; g.fillRect(0,h-20,w,20); g.fillStyle='#b9c9d6'; g.fillRect(10,14,236,46); }));
  const c=f.rq(-19,3,19,24); boxQ(c,0.3,13,sm,M(0x9a3b26),16,6); addBldQ(c,13,'station');
  boxQ(f.rq(-21,5,21,22),13,14.4,roofMat,M(0x9a3b26));
  labelPlane('元朗站',0,9.5,2.9,Math.PI,'#9a3b26',14,f.g);
  LMK.ylstation={patient:f.L(-9,-2.2),stop:curbStop(f,-13)}; }
// 元朗公園（寶塔）
{ const f=placeLM(...RP(1540,-1400),60,40,r=>r.name==='體育路');
  boxQ(f.rq(-30,0,30,40),0,0.34,grassMat,grassMat);
  const pg=new THREE.Group(); pg.position.set(12,0.3,24); f.g.add(pg);   // 七層寶塔
  for(let i=0;i<7;i++){ const r=4.2-i*0.45, y=i*3.0; add(new THREE.CylinderGeometry(r*0.78,r*0.82,2.4,8),M(0xf3e7c9),pg,0,y+1.2,0); add(new THREE.CylinderGeometry(r*0.55,r*1.12,0.8,8),M(0x2f7d5b),pg,0,y+2.7,0); }
  add(new THREE.ConeGeometry(0.9,2.4,8),M(0xd4a017),pg,0,22.6,0); markSeg(f.L(12,24),f.L(12,24),11,2);
  for(let k=0;k<10;k++){ const x=-26+(k%5)*7, z=10+(k>4?14:0); props.tree.push([...f.L(x,z),0,0.05]); }
  add(new THREE.BoxGeometry(6,0.3,2),M(0xffd166),f.g,-12,1.6,6,true);
  labelPlane('元朗公園',-6,4,0.6,Math.PI,'#46a35e',14,f.g);
  LMK.ylpark={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.ylpark=f.L(0,18); MAP.parks.push(f.rq(-30,0,30,40)); }
// 元朗劇院（紅磚外牆、大斜頂）
{ const f=placeLM(...RP(1830,-1400),48,38,r=>r.name==='體育路');
  const tm=texMat('ylth',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#b5523b'; g.fillRect(0,0,w,h); g.fillStyle='rgba(0,0,0,.12)'; for(let y=0;y<h;y+=8) g.fillRect(0,y,w,2); g.fillStyle='#f1e3c8'; g.fillRect(0,h-26,w,26); g.fillStyle='#3c4656'; g.fillRect(90,h-56,76,30); }));
  const c=f.rq(-22,8,22,34); boxQ(c,0.3,14,tm,M(0x8f3d2c),20,8); addBldQ(c,14,'townhall');
  const rf=add(new THREE.CylinderGeometry(0.1,17,8,4),M(0x8f3d2c),f.g,0,18,21,true); rf.rotation.y=Math.PI/4; rf.scale.set(1.3,1,0.75);
  add(new THREE.BoxGeometry(20,0.5,6),M(0xf1e3c8),f.g,0,6,6,true); [-9,9].forEach(x=>add(new THREE.CylinderGeometry(0.4,0.4,5.6,8),M(0xf1e3c8),f.g,x,3,4,true));
  // 搭棚（劇院翻新）：竹棚＋綠色防護網，創傷分流關嘅出事地點
  const sc=new THREE.Group(); sc.position.set(-16,0.3,8); f.g.add(sc); for(let i=0;i<4;i++) for(let j=0;j<5;j++){ add(new THREE.BoxGeometry(0.15,0.15,10),M(0xc8a165),sc,0,j*3+0.5,-3+i*0.05,false).rotation.y=Math.PI/2; }
  for(let i=0;i<5;i++) add(new THREE.CylinderGeometry(0.08,0.08,14,5),M(0xc8a165),sc,-4+i*2,7,-3,false);
  const net=new THREE.Mesh(new THREE.PlaneGeometry(10,13),new THREE.MeshStandardMaterial({color:0x2e8b57,transparent:true,opacity:0.55,side:THREE.DoubleSide})); net.position.set(0,7,-3.3); sc.add(net);
  labelPlane('元朗劇院',2,9,2.8,Math.PI,'#8f3d2c',16,f.g);
  LMK.yltheatre={patient:f.L(-12,-2.2),stop:curbStop(f,-8)}; MAP.poi.yltheatre=f.L(0,24); }

/* ---------- 天水圍區（簡化）：天水圍醫院、救護站、濕地公園、天水圍公園、天水圍站、嘉湖山莊、屏山聚星樓 ---------- */
LMK.ae3=buildHosp('TH','天水圍醫院',['#eef3f8','#3a6ea5'],['#e6f4f1','#2a9d8f']); MAP.poi.hospital3=LMK.ae3.poi;
{ const f=placeLM(...RP(960,-2270),56,40,r=>r.name==='天華路'); const D=buildDepot(f,'天 水 圍 救 護 站','TIN SHUI WAI AMBULANCE DEPOT','TIN SHUI WAI','tsw');
  LMK.depotTSW={pos:D.pos,a:D.a}; MAP.poi.depotTSW=f.L(0,20); }
// 天水圍站（屯馬綫）：月台架空、灰白外牆、啡紅色線條
{ const f=placeLM(...RP(560,-2215),44,28,r=>r.name==='天瑞路');
  const sm=texMat('tswstn',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#e8e4dc'; g.fillRect(0,0,w,h); g.fillStyle='#9a3b26'; g.fillRect(0,h-18,w,18); g.fillStyle='#a9bfd0'; for(let k=0;k<6;k++) g.fillRect(8+k*41,16,33,44); }));
  const c=f.rq(-21,3,21,25); boxQ(c,0.3,14,sm,M(0x9a3b26),16,6); addBldQ(c,14,'station');
  boxQ(f.rq(-23,5,23,23),14,15.2,roofMat,M(0x7d8590));
  labelPlane('天水圍站',0,10,2.9,Math.PI,'#9a3b26',15,f.g);
  LMK.tswstation={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.tswstation=f.L(0,14); }
// 嘉湖山莊：一排排 40 幾層高嘅住宅大廈（同一批材質，合併成少量幾何）
{ const f=placeLM(...RP(500,-2500),64,56,r=>r.name==='天城路');
  boxQ(f.rq(-32,0,32,56),0,0.32,podMat,podMat);
  [[-28,6],[-6,6],[16,6],[-28,32],[-6,32],[16,32]].forEach(([x,z],i)=>{ const q=f.rq(x,z,x+14,z+16), h=88+(i%3)*8; boxQ(q,0.3,h,housingMats[(i+2)%housingMats.length],roofMat,8,3); addBldQ(q,h); });
  labelPlane('嘉湖山莊',0,5,0.4,Math.PI,'#5aa9e6',16,f.g); }
// 天水圍公園：大草地、湖、行人路、涼亭
{ const f=placeLM(...RP(790,-2330),64,44,r=>r.name==='天湖路');
  boxQ(f.rq(-32,0,32,44),0,0.34,grassMat,grassMat);
  const lake=add(new THREE.CylinderGeometry(9,9,0.1,20),M(0x5aa7c8,{r:0.4}),f.g,10,0.4,24,false); lake.scale.set(1.4,1,0.9); markSeg(f.L(10,24),f.L(10,24),24,2);
  const pav=new THREE.Group(); pav.position.set(-16,0.34,26); f.g.add(pav);
  [[-2,-2],[2,-2],[2,2],[-2,2]].forEach(([x,z])=>add(new THREE.CylinderGeometry(0.2,0.2,3,6),M(0xb5523b),pav,x,1.5,z,false));
  add(new THREE.ConeGeometry(4,1.8,4),M(0x2f7d5b),pav,0,3.9,0,true).rotation.y=Math.PI/4; markSeg(f.L(-16,26),f.L(-16,26),6,2);
  for(let k=0;k<12;k++){ const x=-28+(k%6)*11, z=k>5?38:8; props.tree.push([...f.L(x,z),0,0.05]); }
  labelPlane('天水圍公園',-6,4,0.6,Math.PI,'#46a35e',15,f.g);
  LMK.tswpark={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.tswpark=f.L(0,20); MAP.parks.push(f.rq(-32,0,32,44)); }
// 香港濕地公園：訪客中心（草地斜頂）、濕地水塘、木棧道、觀鳥屋
{ const f=placeLM(...RP(650,-2700),84,50,r=>r.name==='天恩路');
  boxQ(f.rq(-42,0,42,50),0,0.3,M(0x8fbf6a,{r:0.95}),M(0x8fbf6a,{r:0.95}));
  const vc=f.rq(-38,4,-6,22); boxQ(vc,0.3,7,texMat('wlvc',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#d8cdb8'; g.fillRect(0,0,w,h); g.fillStyle='#7fa9c4'; g.fillRect(0,22,w,48); g.fillStyle='rgba(255,255,255,.4)'; for(let k=0;k<12;k++) g.fillRect(k*22,22,3,48); })),M(0x6aa84f),16,7); addBldQ(vc,7,'plaza');
  const rf=add(new THREE.BoxGeometry(34,0.6,20),M(0x6aa84f),f.g,-22,8.2,13,true); rf.rotation.x=-0.12;
  const pond=add(new THREE.CylinderGeometry(14,14,0.1,24),M(0x4f9fc2,{r:0.35}),f.g,18,0.4,28,false); pond.scale.set(1.5,1,1); markSeg(f.L(18,28),f.L(18,28),40,2);
  for(let k=0;k<6;k++) add(new THREE.BoxGeometry(2.2,0.25,5.2),M(0xa0764a),f.g,4+k*5,0.6,16+k*2.2,false).rotation.y=0.4;   // 木棧道
  const bh=new THREE.Group(); bh.position.set(34,0.3,38); f.g.add(bh); add(new THREE.BoxGeometry(6,3,4),M(0x8a6a48),bh,0,1.8,0,true); add(new THREE.ConeGeometry(4.6,1.6,4),M(0x5b4632),bh,0,4.1,0,true).rotation.y=Math.PI/4; markSeg(f.L(34,38),f.L(34,38),7,2);
  for(let k=0;k<14;k++){ const a=k/14*6.28; props.tree.push([...f.L(18+Math.cos(a)*24,28+Math.sin(a)*15),0,0.05]); }
  labelPlane('香港濕地公園',-22,4.4,3.6,Math.PI,'#3f8f5a',20,f.g);
  LMK.tswwet={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.tswwet=f.L(0,24); MAP.parks.push(f.rq(-42,0,42,50)); }
// 屏山聚星樓：六角形三層青磚塔
{ const f=placeLM(...RP(1110,-2030),40,30,r=>r.name==='屏廈路');
  boxQ(f.rq(-20,0,20,30),0,0.32,M(0xc9bfa8,{r:0.95}),M(0xc9bfa8,{r:0.95}));
  const pg=new THREE.Group(); pg.position.set(6,0.3,17); f.g.add(pg);
  add(new THREE.CylinderGeometry(4.6,4.8,1,6),M(0x9a9486),pg,0,0.5,0,true);
  [[4.2,5.2],[3.6,4.4],[3.0,3.8]].forEach(([r,h],i)=>{ const y=1+[0,5.2,9.6][i]; add(new THREE.CylinderGeometry(r*0.92,r,h,6),M(0x8f8a7c),pg,0,y+h/2,0,true); add(new THREE.CylinderGeometry(r*0.7,r*1.12,0.5,6),M(0x6e6a60),pg,0,y+h-0.1,0,false); });
  add(new THREE.ConeGeometry(1.2,2,6),M(0x6e6a60),pg,0,14.9,0,false); markSeg(f.L(6,17),f.L(6,17),11,2);
  for(let k=0;k<5;k++) props.tree.push([...f.L(-16+k*3,24),0,0.05]);
  labelPlane('聚星樓',-8,4,0.6,Math.PI,'#6e6a60',12,f.g);
  LMK.jusing={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.jusing=f.L(0,16); }

}   // ===== 屯門地標完 =====
if(REGION==='st'){   // ===== 沙田區：以源禾路（沙田消防局暨救護站）為中心，其他道路簡化；威爾斯親王醫院、沙田／田心救護站、新城市廣場、沙田站、沙田公園、馬場、車公廟、文化博物館、曾大屋、第一城、萬佛寺、望夫石 =====
LMK.ae=buildHosp('PWH','威爾斯親王醫院',['#eef1f6','#1f5fa8'],['#e8f0fb','#1f5fa8']); MAP.poi.hospital=LMK.ae.poi;
// 沙田消防局暨救護站（源禾路26號，城門河邊、划艇中心隔籬）
{ const f=placeLM(...RP(890,-700),56,40,r=>r.name==='源禾路'); const D=buildDepot(f,'沙 田 救 護 站','SHA TIN AMBULANCE DEPOT','26 YUEN WO ROAD','st');
  LMK.parkedAmb=[[f.L(10,7),D.face],[f.L(21,7),D.face]]; LMK.parkedAmb.forEach(([p])=>markSeg(p,p,6,2)); LMK.depot={pos:D.pos,a:D.a}; MAP.poi.depot=f.L(0,20);
  const g=placeLM(...RP(975,-800),44,36,r=>r.name==='源禾路');
  const fm=texMat('fireST',canvasTex(256,96,(g2,w,h)=>{ g2.fillStyle='#ffd9cf'; g2.fillRect(0,0,w,h); g2.fillStyle='#c1121f'; g2.fillRect(0,h-16,w,16); g2.fillStyle='#8fb8d8'; g2.fillRect(30,20,70,40); g2.fillRect(156,20,70,40); }));
  const c2=g.rq(-20,8,20,34); boxQ(c2,0.3,14,fm,M(0xc1121f),8,3); addBldQ(c2,14); for(let k=0;k<3;k++) add(new THREE.BoxGeometry(9,6.4,0.3),M(0xc1121f),g.g,-12+k*12,3.4,7.85,false);
  const tw=g.rq(14,22,19,27); boxQ(tw,0.3,24,M(0xc1121f),M(0x8a0d16)); addBldQ(tw,24);   // 消防訓練塔
  labelPlane('沙田消防局',0,10.5,7.7,Math.PI,'#c1121f',16,g.g); }
{ const f=placeLM(...RP(-850,560),56,40,r=>r.name==='富健街'); const D=buildDepot(f,'田 心 救 護 站','TIN SAM AMBULANCE DEPOT','2 FU KIN STREET','ts'); LMK.depotTS={pos:D.pos,a:D.a}; MAP.poi.depotTS=f.L(0,20); }
// 沙田划艇中心：船屋、草地上一排獨木舟
{ const f=placeLM(...RP(1050,-900),40,30,r=>r.name==='源禾路');
  const c=f.rq(-18,4,4,18); boxQ(c,0.3,7,texMat('rowc',canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#eef3f6'; g.fillRect(0,0,w,h); g.fillStyle='#2a7ab8'; g.fillRect(0,h-10,w,10); g.fillStyle='#8fb8d8'; for(let x=8;x<w;x+=30) g.fillRect(x,14,20,24); })),M(0x2a7ab8),10,3); addBldQ(c,7);
  ['#e94e1b','#ffd166','#2a9d8f','#e94e1b','#3a86ff'].forEach((col,k)=>{ const b=add(new THREE.BoxGeometry(1.2,0.6,7),M(new THREE.Color(col).getHex()),f.g,8+k*2.4,0.7,18,false); });
  labelPlane('沙田划艇中心',0,4,0.5,Math.PI,'#2a7ab8',14,f.g); }
// 香港體育學院（源禾路25號）
{ const f=placeLM(...RP(1060,-1170),60,44,r=>r.name==='源禾路');
  boxQ(f.rq(-30,0,30,44),0,0.32,grassMat,grassMat);
  const c=f.rq(-28,4,6,24); boxQ(c,0.3,12,texMat('hksi',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#f2f4f7'; g.fillRect(0,0,w,h); g.fillStyle='#d62839'; g.fillRect(0,0,w,10); g.fillStyle='#93b0c4'; for(let r=0;r<3;r++) g.fillRect(6,22+r*22,w-12,12); })),M(0xd62839),12,3); addBldQ(c,12);
  const trk=add(new THREE.RingGeometry(8,11,28),M(0xc0503a,{r:0.95}),f.g,18,0.36,26,false); trk.rotation.x=-Math.PI/2; trk.scale.set(1.3,1,1);
  labelPlane('香港體育學院',0,4,0.5,Math.PI,'#d62839',16,f.g); MAP.parks.push(f.rq(8,10,30,42)); }
// 沙田運動場（源禾路18號）：400 米跑道、看台
{ const f=placeLM(...RP(600,-150),70,56,r=>r.name==='源禾路');
  boxQ(f.rq(-35,0,35,56),0,0.32,grassMat,grassMat);
  const trk=add(new THREE.RingGeometry(14,19,40),M(0xc0503a,{r:0.95}),f.g,0,0.36,30,false); trk.rotation.x=-Math.PI/2; trk.scale.set(1.6,1,1);
  const fd=add(new THREE.PlaneGeometry(36,22),M(0x5fae4a,{r:0.95}),f.g,0,0.37,30,false); fd.rotation.x=-Math.PI/2;
  const st=f.rq(-24,2,24,7); boxQ(st,0.3,9,M(0xdfe3e6),M(0x2a7ab8),12,3); addBldQ(st,9);
  labelPlane('沙田運動場',0,9.6,1.6,Math.PI,'#2a7ab8',16,f.g); MAP.parks.push(f.rq(-35,8,35,56)); LMK.stsport={patient:f.L(-14,-2.2),stop:curbStop(f,-18)}; MAP.poi.stsport=f.L(0,30); }
// 沙田賽馬會游泳池
{ const f=placeLM(...RP(300,-250),40,30,r=>r.name==='沙田鄉事會路');
  const c=f.rq(-18,2,0,26); boxQ(c,0.3,8,M(0xe6eef2),M(0x2a7ab8),10,3); addBldQ(c,8);
  const pl=add(new THREE.BoxGeometry(14,0.1,20),M(0x4fc3f7,{r:0.3}),f.g,10,0.4,15,false);
  labelPlane('沙田賽馬會游泳池',0,4,0.5,Math.PI,'#2a7ab8',14,f.g); }
// 禾輋廣場
{ const f=placeLM(...RP(400,-380),44,32,r=>r.name==='禾輋街');
  const c=f.rq(-21,2,21,30); boxQ(c,0.3,10,pick(shopMats),podMat,24,4.5); addBldQ(c,10,'plaza'); const t=f.rq(-10,10,10,26); boxQ(t,10,48,housingMats[2],roofMat,8,3);
  labelPlane('禾輋廣場',0,6,2.1,Math.PI,'#e07a1f',14,f.g); LMK.stwoche={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.stwoche=f.L(0,16); }
// 沙田大會堂
{ const f=placeLM(...RP(250,240),44,30,r=>r.name==='担杆莆街');
  const c=f.rq(-20,4,20,28); boxQ(c,0.3,13,texMat('sttownh',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#e9e3d6'; g.fillRect(0,0,w,h); g.fillStyle='#8a6e4b'; for(let x=10;x<w;x+=26) g.fillRect(x,8,8,h-16); })),M(0x8a6e4b),10,3); addBldQ(c,13);
  labelPlane('沙田大會堂',0,4,0.6,Math.PI,'#8a6e4b',14,f.g); LMK.sttownh={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.sttownh=f.L(0,16); }
// 新城市廣場：大型商場，玻璃幕牆、上面有寫字樓
{ const f=placeLM(...RP(230,70),58,42,r=>r.name==='橫壆街');
  const gm=texMat('ntp',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#cfd8e3'; g.fillRect(0,0,w,h); g.fillStyle='#7fa7c9'; for(let x=6;x<w;x+=22) g.fillRect(x,10,16,h-20); g.fillStyle='#e94e1b'; g.fillRect(0,0,w,8); }));
  const c=f.rq(-28,2,28,40); boxQ(c,0.3,16,gm,roofMat,12,3); addBldQ(c,16,'plaza'); const t=f.rq(-12,12,14,36); boxQ(t,16,62,housingMats[1],roofMat,8,3);
  labelPlane('新城市廣場',0,12,1.8,Math.PI,'#e94e1b',26,f.g); LMK.stntp={patient:f.L(-12,-2.2),stop:curbStop(f,-16)}; MAP.poi.stntp=f.L(0,24); }
// 沙田站（東鐵綫）
{ const f=placeLM(...RP(-110,70),44,26,r=>r.name==='沙田正街');
  const sm=texMat('ststn',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#e8eef3'; g.fillRect(0,0,w,h); g.fillStyle='#5eb7e8'; g.fillRect(0,h-18,w,18); g.fillStyle='#a9bfd0'; for(let k=0;k<6;k++) g.fillRect(8+k*41,16,33,44); }));
  const c=f.rq(-21,3,21,24); boxQ(c,0.3,12,sm,roofMat,16,6); addBldQ(c,12,'station'); labelPlane('沙田站',0,9,2.9,Math.PI,'#3a8fc4',14,f.g); LMK.ststn={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.ststn=f.L(0,14); }
// 沙田公園：城門河邊大草地、湖、單車徑
{ const f=placeLM(...RP(470,40),64,40,r=>r.name==='源禾路');
  boxQ(f.rq(-32,0,32,40),0,0.32,grassMat,grassMat); const ln=add(new THREE.BoxGeometry(60,0.05,3),M(0xb5523b,{r:0.9}),f.g,0,0.36,34,false);   // 單車徑
  for(let k=0;k<14;k++) props.tree.push([...f.L(-30+(k%7)*10,k>6?26:10),0,0.05]);
  labelPlane('沙田公園',0,4,0.6,Math.PI,'#46a35e',14,f.g); LMK.stpark={patient:f.L(6,30),stop:curbStop(f,-4)}; MAP.poi.stpark=f.L(0,20); MAP.parks.push(f.rq(-32,0,32,40)); }
// 沙田馬場：橢圓跑道、看台
{ const f=placeLM(...RP(1300,-1120),130,70,r=>r.name==='源禾路');
  boxQ(f.rq(-65,0,65,70),0,0.3,M(0x7cc25a,{r:0.95}),M(0x7cc25a,{r:0.95}));
  const trk=add(new THREE.RingGeometry(20,27,40),M(0xc9a26b,{r:0.95}),f.g,0,0.34,40,false); trk.rotation.x=-Math.PI/2; trk.scale.set(2.2,1,1);
  const st=f.rq(-40,3,40,13); boxQ(st,0.3,18,texMat('grand',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#e9ece6'; g.fillRect(0,0,w,h); g.fillStyle='#2f6b4f'; g.fillRect(0,0,w,14); g.fillStyle='#93b0c4'; for(let r=0;r<3;r++) g.fillRect(4,24+r*22,w-8,12); })),M(0x2f6b4f),18,4); addBldQ(st,18);
  labelPlane('沙田馬場',0,21,2.4,Math.PI,'#2f6b4f',20,f.g); LMK.strace={patient:f.L(-20,-2.2),stop:curbStop(f,-24)}; MAP.poi.strace=f.L(0,40); MAP.parks.push(f.rq(-65,14,65,70)); }
// 車公廟：紅柱黃瓦
{ const f=placeLM(...RP(0,1300),44,34,r=>r.name==='車公廟路');
  boxQ(f.rq(-22,0,22,34),0,0.3,M(0xd9c7a3,{r:0.95}),M(0xd9c7a3,{r:0.95}));
  const t=new THREE.Group(); t.position.copy(new THREE.Vector3(0,0.3,20)); f.g.add(t);
  add(new THREE.BoxGeometry(18,6,10),M(0xb22a1e),t,0,3,0,true); const rf=add(new THREE.ConeGeometry(13,4,4),M(0xe2b13c),t,0,8,0,true); rf.rotation.y=Math.PI/4; rf.scale.set(1,1,0.62);
  add(new THREE.BoxGeometry(4,4.5,1),M(0x6b1d14),t,0,2.3,5.05,false); markSeg(f.L(0,20),f.L(0,20),20,2);
  labelPlane('車公廟',0,4,0.6,Math.PI,'#b22a1e',12,f.g); LMK.stck={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.stck=f.L(0,18); }
// 香港文化博物館
{ const f=placeLM(...RP(-50,1060),56,36,r=>r.name==='大涌橋路');
  const c=f.rq(-26,4,26,32); boxQ(c,0.3,10,texMat('hkhm',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#d8d2c6'; g.fillRect(0,0,w,h); g.fillStyle='#8a7d6b'; for(let x=10;x<w;x+=40) g.fillRect(x,30,24,40); })),M(0x6d6a63),10,3); addBldQ(c,10);
  const rf=add(new THREE.ConeGeometry(30,5,4),M(0x5f6b73),f.g,0,12.5,18,true); rf.rotation.y=Math.PI/4; rf.scale.set(1,1,0.55);
  labelPlane('香港文化博物館',0,4,0.6,Math.PI,'#6d6a63',18,f.g); }
// 曾大屋：青磚圍屋、四角碉樓
{ const f=placeLM(...RP(520,900),48,44,r=>r.name==='沙角街');
  const wm=M(0x8e96a0,{r:0.9}); const o=[-22,4,22,42]; [[o[0],o[1],o[2],o[1]+2],[o[0],o[3]-2,o[2],o[3]],[o[0],o[1],o[0]+2,o[3]],[o[2]-2,o[1],o[2],o[3]]].forEach(([a,b,c,d])=>{ const q=f.rq(a,b,c,d); boxQ(q,0.3,7,wm,M(0x5f666e),6,3); addBldQ(q,7); });
  [[o[0],o[1]],[o[2]-5,o[1]],[o[0],o[3]-5],[o[2]-5,o[3]-5]].forEach(([a,b])=>{ const q=f.rq(a,b,a+5,b+5); boxQ(q,0.3,11,wm,M(0x4c535a),3,4); });
  boxQ(f.rq(-4,3.9,4,4.2),0.3,4.5,M(0x3a2a20),M(0x3a2a20));
  labelPlane('曾大屋',0,9,3.6,Math.PI,'#5f666e',12,f.g); LMK.sttsang={patient:f.L(-8,-2.2),stop:curbStop(f,-12)}; MAP.poi.sttsang=f.L(0,22); }
// 沙田第一城：一排排住宅
{ const f=placeLM(...RP(1550,-760),64,50,r=>r.name==='沙田路');
  boxQ(f.rq(-32,0,32,50),0,0.32,podMat,podMat);
  [[-28,6],[-6,6],[16,6],[-28,30],[-6,30],[16,30]].forEach(([x,z],i)=>{ const q=f.rq(x,z,x+13,z+14), h=70+(i%2)*8; boxQ(q,0.3,h,housingMats[(i+4)%housingMats.length],roofMat,8,3); addBldQ(q,h); });
  labelPlane('沙田第一城',0,5,0.4,Math.PI,'#5aa9e6',18,f.g); LMK.stcity={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.stcity=f.L(0,24); }
// 萬佛寺：排頭街山腳入口牌坊，山頂紅色九層塔
{ const f=placeLM(...RP(-250,-330),40,24,r=>r.name==='排頭街');
  const gate=new THREE.Group(); gate.position.set(0,0.3,8); f.g.add(gate);
  [-6,6].forEach(x=>add(new THREE.BoxGeometry(1,7,1),M(0xb22a1e),gate,x,3.5,0,false)); add(new THREE.BoxGeometry(15,1.4,2),M(0xe2b13c),gate,0,7.5,0,false);
  labelPlane('萬佛寺',0,9.4,1.1,Math.PI,'#b22a1e',10,gate);
  const H=f.L(0,70), hm=M(0x5d8f4e,{r:0.95}); hillQ(H[0],H[1],46,40,40,0.4,hm); for(let zz=H[1]-46;zz<=H[1]+46;zz+=CELL) for(let xx=H[0]-46;xx<=H[0]+46;xx+=CELL) if(Math.hypot(xx-H[0],zz-H[1])<44){ const q=gi(xx,zz); if(q>=0) grid[q]|=2|8; }
  const pg=new THREE.Group(); pg.position.set(H[0],38,H[1]); scene.add(pg);
  for(let i=0;i<9;i++){ const r=4-i*0.3, y=i*3; add(new THREE.CylinderGeometry(r*0.9,r,2.6,8),M(0xc8382a),pg,0,y+1.3,0,i<2); add(new THREE.CylinderGeometry(r*0.6,r*1.18,0.6,8),M(0xe2b13c),pg,0,y+2.8,0,false); }
  add(new THREE.ConeGeometry(1,3,8),M(0xe2b13c),pg,0,28.5,0,false);
  LMK.stbuddha={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.stbuddha=f.L(0,14); }
// 望夫石：南面山頂嘅石柱（遠景）
{ const P=RP(-520,1400), hm=M(0x6a9f58,{r:0.95}); hillQ(P[0],P[1],70,70,60,1.1,hm);
  const rk=new THREE.Group(); rk.position.set(P[0],66,P[1]); scene.add(rk); add(new THREE.CylinderGeometry(2.6,3.4,12,7),M(0x9a9184),rk,0,6,0,true); add(new THREE.SphereGeometry(2.8,8,6),M(0x9a9184),rk,0.6,13,0,true);
  for(let zz=P[1]-70;zz<=P[1]+70;zz+=CELL) for(let xx=P[0]-70;xx<=P[0]+70;xx+=CELL) if(Math.hypot(xx-P[0],zz-P[1])<66){ const q=gi(xx,zz); if(q>=0&&!(grid[q]&1)) grid[q]|=2|8; } }
}   // ===== 沙田地標完 =====

/* ---------- 一般樓宇：沿街＋內街 ---------- */
const zoneOf=(x,z)=>x>20&&z<60?'old':(x>-10&&z>140?'centre':'res');
const ZMIX={old:['tong','tong','tong','shops','tong','estate'],centre:['tong','shops','estate','tong','shops','estate'],res:['estate','estate','tong','shops','estate','tong']};
function buildTong(c,front,nx,nz){ const h=13+rnd()*13; boxQ(c,0.3,4.8,pick(shopMats),roofMat,24,4.5,rnd()*4|0);
  const ci=c.map(([x,z])=>{ const cx=(c[0][0]+c[2][0])/2, cz=(c[0][1]+c[2][1])/2; return [x+(cx-x)*0.04,z+(cz-z)*0.04]; });
  boxQ(ci,4.8,h,pick(tongMats),roofMat,8.5,3); addBldQ(c,h);
  if(rnd()<0.7) signs.push({x:front[0]-nx*1.3,z:front[1]-nz*1.3,y:6.5+rnd()*5,a:Math.atan2(-nx,-nz)}); }
function buildShops(c){ boxQ(c,0.3,4.8,pick(shopMats),roofMat,24,4.5); boxQ(c,4.8,10,pick(tongMats),roofMat,8.5,3); addBldQ(c,10); }
function buildEstate(L,w,d){ const pod=4.8; let c=[L(0,0),L(w,0),L(w,d),L(0,d)]; boxQ(c,0.3,pod,pick(shopMats),podMat,24,4.5); addBldQ(c,pod);
  const hm=pick(housingMats); let top=pod; const n=w>30?2:1;
  for(let k=0;k<n;k++){ const tw=14, td=Math.min(14,d-6); const cx=n===1?w/2:(k?w-tw/2-3:tw/2+3); const h=pod+18+rnd()*16; top=Math.max(top,h);
    boxQ([L(cx-tw/2,d/2-td/2),L(cx+tw/2,d/2-td/2),L(cx+tw/2,d/2+td/2),L(cx-tw/2,d/2+td/2)],pod,h,hm,roofMat,8,3); }
  MAP.blds[MAP.blds.length-1].h=top; }
// 沿街
const J3=NODES.map((_,i)=>i).filter(i=>DEG[i]>=3);
MAP.roads.forEach(r=>{ if(r.bridge||r.elev) return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,Lr]=dirn(A,B);
  [1,-1].forEach(side=>{ const nx=uz*side, nz=-ux*side; const off=r.w/2+5.2;
    let s=(DEG[a]>=3?NW[a]+5:DEG[a]===2?0.5:2); const s1=Lr-(DEG[b]>=3?NW[b]+5:DEG[b]===2?0.5:2);
    // 沿住路邊每隔一段放樹／街燈
    for(let q=s+3;q<s1-2;q+=11){ const P=d=>[A[0]+ux*d+nx*(r.w/2+1.4), A[1]+uz*d+nz*(r.w/2+1.4)];   // 街燈加密：每 11 米一支，樹擺喺兩支街燈中間
      const [x,z]=P(q); props.lamp.push([x,z,Math.atan2(-nx,-nz),0.1]); if((q/11|0)%2&&q+5.5<s1-2){ const [tx,tz]=P(q+5.5); props.tree.push([tx,tz,Math.atan2(-nx,-nz),0.1]); } }
    while(s<s1-6){ const x=A[0]+ux*s, z=A[1]+uz*s; const zn=zoneOf(x,z); let type=pick(ZMIX[zn]);
      let bw=type==='estate'?34+rnd()*8:type==='shops'?16+rnd()*8:9+rnd()*5, bd=type==='estate'?26:type==='shops'?12:13;
      if(s+bw>s1){ if(type==='estate'){ type='tong'; bw=9+rnd()*5; bd=13; } if(s+bw>s1) bw=s1-s; if(bw<7) break; }
      const L=(lx,lz)=>[x+ux*lx+nx*(off+lz),z+uz*lx+nz*(off+lz)];
      const c=[L(0,0),L(bw,0),L(bw,bd),L(0,bd)];
      const underHW=[[0,0],[bw/2,0],[bw,0],[0,bd/2],[bw/2,bd/2],[bw,bd/2],[0,bd],[bw/2,bd],[bw,bd],[bw/2,-1.8]].some(([lx,lz])=>{ const p=L(lx,lz); return ELEV(p[0],p[1],8)>0.02; });   // 高架路底／旁邊唔起樓（會變空氣牆）
      const nearJ=[[0,-1.8],[bw,-1.8],[0,bd],[bw,bd]].some(([lx,lz])=>{ const p=L(lx,lz); return J3.some(n=>{ const N=NODES[n]; return Math.hypot(N[0]-p[0],N[1]-p[1])<NW[n]+r.w/2+3; }); });   // 唔好起到路口轉角入面
      if(!underHW&&!nearJ&&quadFree(c,0.5)){ boxQ([L(0,-1.8),L(bw,-1.8),L(bw,0.2),L(0,0.2)],0,0.11,walkMat,walkMat); if(type==='tong') buildTong(c,L(bw/2,0),nx,nz); else if(type==='shops') buildShops(c); else buildEstate(L,bw,bd); DFRONT.push({c,type,h:MAP.blds[MAP.blds.length-1].h}); s+=bw+0.3; }
      else s+=3; } }); });
const VCOL=['#fff1d6','#e8f4ff','#ffe3e3','#e9f7df','#f3e8ff'];
const villageMats=VCOL.map((w,k)=>texMat('v'+k,canvasTex(128,96,(g,W,H)=>{ g.fillStyle=w; g.fillRect(0,0,W,H); g.fillStyle='#8fb8d8'; g.fillRect(20,24,34,30); g.fillRect(74,24,34,30); g.fillStyle='#c9b8a6'; g.fillRect(0,H-6,W,6); g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(20,52,34,4); g.fillRect(74,52,34,4); })));
// 郊區山丘（元朗公路兩邊）：高架附近唔起樓，改為一層層山
function hwDist(x,z){ let best=1e9; for(const T of HWS) for(let i=1;i<T.pts.length;i++){ const A=T.pts[i-1],B=T.pts[i], dx=B[0]-A[0], dz=B[1]-A[1], L2=dx*dx+dz*dz||1; let t=((x-A[0])*dx+(z-A[1])*dz)/L2; t=t<0?0:t>1?1:t; best=Math.min(best,Math.hypot(x-A[0]-dx*t,z-A[1]-dz*t)); } return best; }
const nearHW=(x,z)=>rural(x,z)&&hwDist(x,z)<175;
{ const hm=[M(0x7fb069,{r:0.95}),M(0x6a9f58,{r:0.95}),M(0x8cbf73,{r:0.95}),M(0x5d8f4e,{r:0.95})];
  const tryHill=(x,z,r,h)=>{ if(REGION==='tm'&&(!rural(x,z)||z-r<-830)) return; for(let a=0;a<6.28;a+=0.45) for(const q of [0.3,0.65,1]) if(cellAt(x+Math.cos(a)*r*q,z+Math.sin(a)*r*q)&(1|4|8|16)) return;
    hillQ(x,z,r,h,r*(0.75+rnd()*0.5),rnd()*6,pick(hm));
    for(let zz=z-r;zz<=z+r;zz+=CELL) for(let xx=x-r;xx<=x+r;xx+=CELL) if(Math.hypot(xx-x,zz-z)<r*0.95){ const q=gi(xx,zz); if(q>=0) grid[q]|=2|8; }
    for(let t=0;t<3;t++){ const a=rnd()*6.28, d=r*(0.15+rnd()*0.4); props.tree.push([x+Math.cos(a)*d,z+Math.sin(a)*d,0,h*0.75]); } };
  for(const HL of HWS) for(let s=10;s<HL.L;s+=16) for(const sd of [-1,1]) for(const [o0,o1,r0,r1,h0,h1] of [[30,60,12,20,7,14],[70,120,20,32,14,26],[130,175,28,42,22,40]]){
    const k=Math.max(1,Math.min(HL.pts.length-1,HL.cum.findIndex(c=>c>=s))); const A=HL.pts[k-1],B=HL.pts[k]; const [ux,uz]=dirn(A,B); const nx=uz*sd, nz=-ux*sd;
    const off=o0+rnd()*(o1-o0), x=A[0]+ux*(rnd()-0.5)*14+nx*off, z=A[1]+uz*(rnd()-0.5)*14+nz*off; tryHill(x,z,r0+rnd()*(r1-r0),h0+rnd()*(h1-h0)); }
  // 沙田：谷地四周係山（離馬路遠過 75 米嘅地方起山，越遠越高）
  if(REGION==='st'){ const rd=(x,z)=>{ const E=nearestEdge(x,z); return E?Math.hypot(E.R[0]-x,E.R[1]-z):1e9; };
    northWild=(x,z)=>rd(x,z)>75;
    for(let z=BZ0+10;z<BZ1;z+=30) for(let x=BX0+10;x<BX1;x+=30){ const d=rd(x,z); if(d<85||riverDist(x,z)<RIVH+30) continue; const k=Math.min(1,(d-85)/220);
      tryHill(x+(rnd()-0.5)*14,z+(rnd()-0.5)*14,22+rnd()*18+k*26,12+rnd()*14+k*60); } } }
// 北面郊野（天水圍以外）：一格格魚塘（平面幾何，好慳效能）
{ const bank=[], water=[];
  for(let z=BZ0+16;z<-850;z+=27) for(let x=BX0+16;x<BX1-16;x+=33){ if(!northWild(x,z)) continue; const w=26+rnd()*4, d=20+rnd()*3;
    const c=rectQ(x-w/2,z-d/2,x+w/2,z+d/2); if(!quadFree(c,3)) continue; const E=nearestEdge(x,z); if(Math.hypot(E.R[0]-x,E.R[1]-z)<E.r.w/2+18) continue;
    quadA(bank,c); quadA(water,rectQ(x-w/2+1.6,z-d/2+1.6,x+w/2-1.6,z+d/2-1.6)); markQuad(c,4|8); }
  if(bank.length){ flat(bank,M(0x9fb487,{r:0.95}),0.02); flat(water,M(0x5aa7c8,{r:0.6}),0.06); } }
// 內街空地：補屋邨高樓或小公園（郊區就用低層建築、停車場、草地）
for(let z=BZ0+20;z<BZ1-20;z+=20) for(let x=BX0+20;x<BX1-20;x+=20){
  const E=nearestEdge(x,z); const ang=Math.atan2(E.nx,E.nz); const ux=Math.cos(ang), uz=-Math.sin(ang), nx=E.nx, nz=E.nz;
  const L=(lx,lz)=>[x+ux*lx+nx*lz,z+uz*lx+nz*lz];
  const c=[L(-11,-9),L(11,-9),L(11,9),L(-11,9)]; if(!quadFree(c,3)) continue; const rur=rural(x,z), q=rnd();
  if(northWild(x,z)){ if(rnd()<0.12) props.tree.push([x+(rnd()-0.5)*16,z+(rnd()-0.5)*14,0,0]); continue; }
  if(nearHW(x,z)){ if(rnd()<0.3) props.tree.push([x+(rnd()-0.5)*16,z+(rnd()-0.5)*14,0,0]); continue; }
  if(rur&&q<0.25){ const h=8+rnd()*8; const cc=[L(-9,-7),L(9,-7),L(9,7),L(-9,7)]; boxQ(cc,0,h,pick(villageMats),roofMat,8,3); addBldQ(cc,h); boxQ(c,0,0.25,podMat,podMat); markQuad(c,8); }
  else if(rur&&q>0.6){ boxQ(c,0,0.25,grassMat,grassMat); markQuad(c,8); for(let k=0;k<3;k++) props.tree.push([x+(rnd()-0.5)*18,z+(rnd()-0.5)*14,0,0.25]); }
  else if(!rur&&rnd()<0.75){ const h=26+rnd()*20; boxQ([L(-8,-7),L(8,-7),L(8,7),L(-8,7)],0,h,pick(housingMats),roofMat,8,3); addBldQ([L(-8,-7),L(8,-7),L(8,7),L(-8,7)],h);
    boxQ(c,0,0.25,podMat,podMat); markQuad(c,8); }
  else if(rur||rnd()<0.5){ boxQ(c,0,0.25,M(0x8a919c,{r:0.9}),M(0x8a919c,{r:0.9})); markQuad(c,8); // 停車場
    for(let k=0;k<4;k++) for(const r of [-1,1]){ const p=L(-7.5+k*5,r*4.5); parked.push([p[0],p[1],Math.atan2(nx*r,nz*r)]); markSeg(p,p,4,2); } }
  else { boxQ(c,0,0.25,grassMat,grassMat); markQuad(c,8); for(let k=0;k<4;k++) props.tree.push([x+(rnd()-0.5)*18,z+(rnd()-0.5)*14,0,0.25]); } }
// 再細啲嘅空位：村屋／低層樓

for(let z=BZ0+10;z<BZ1-10;z+=11) for(let x=BX0+10;x<BX1-10;x+=11){
  const xx=x+(rnd()-0.5)*4, zz=z+(rnd()-0.5)*4; const E=nearestEdge(xx,zz); const ux=E.nz, uz=-E.nx;
  const w=7+rnd()*3, d=7+rnd()*3; const L=(lx,lz)=>[xx+ux*lx+E.nx*lz,zz+uz*lx+E.nz*lz]; const c=[L(-w/2,-d/2),L(w/2,-d/2),L(w/2,d/2),L(-w/2,d/2)];
  if(!quadFree(c,1.5)||nearHW(xx,zz)||northWild(xx,zz)) continue; if(xx>150&&xx<375&&zz<-850&&zz>-1050){ const h=30+(rnd()*5|0)*6; boxQ(c,0,h,pick(housingMats),roofMat,8,3); addBldQ(c,h); continue; } const h=6+(rnd()*3|0)*3; boxQ(c,0,h,pick(villageMats),roofMat,8,3); addBldQ(c,h); }
// 剩低嘅草地：散樹
for(let k=0;k<500;k++){ const x=BX0+rnd()*(BX1-BX0), z=BZ0+rnd()*(BZ1-BZ0); if(!cellAt(x,z)&&!cellAt(x+3,z)&&!cellAt(x-3,z)) props.tree.push([x,z,0,0]); }
flushBuckets();

/* ---------- 遠景：外圍樓群、海、山 ---------- */
function farScene(){
  const ring=(d0,d1,hmin,hmax,step,mats)=>{ for(let side=0;side<4;side++){ if(side===1) continue; const horiz=side<2; const a0=horiz?BX0-d1:BZ0-d1, a1=horiz?BX1+d1:BZ1+20;
      for(let a=a0;a<a1;a+=step*(0.8+rnd()*0.6)){ const w=step*(0.55+rnd()*0.3), dd=d0+rnd()*(d1-d0-w), h=hmin+rnd()*(hmax-hmin);
        let x0,z0; if(horiz){ x0=a; z0=BZ0-dd-w; } else { z0=a; x0=side===2?BX0-dd-w:BX1+dd; }
        boxQ(rectQ(x0,z0,x0+w,z0+w),0,h,pick(mats),roofMat,8,3); } } };
  ring(14,44,8,22,26,[...tongMats,...shopMats]); ring(60,150,30,60,30,housingMats); flushBuckets();
  // 南面：青山灣（海）、沙灘、船
  const sea=add(new THREE.PlaneGeometry(2600,1000),new THREE.MeshStandardMaterial({color:0x5fb8e6,roughness:0.3}),scene,(BX0+BX1)/2,0.02,BZ1+560,false); sea.rotation.x=-Math.PI/2;
  const sand=add(new THREE.PlaneGeometry(2600,40),M(0xf3e2b3,{r:1}),scene,(BX0+BX1)/2,0.04,BZ1+40,false); sand.rotation.x=-Math.PI/2;
  for(let k=0;k<7;k++){ const b=new THREE.Group(); b.position.set(BX0-200+k*130,0.4,BZ1+160+rnd()*260); scene.add(b);
    add(new THREE.BoxGeometry(4,1.4,12),M(0xffffff),b,0,0.5,0,false); add(new THREE.BoxGeometry(3,2,4),M([0xe63946,0x457b9d,0xf4a261][k%3]),b,0,2,1,false); b.rotation.y=rnd()*3; }
  const mt=(x,z,r,h,col)=>{ const g=new THREE.ConeGeometry(r*1.3,h*0.75,9,3); const pa=g.attributes.position; for(let q=0;q<pa.count;q++){ const y=pa.getY(q); if(y>-h*0.37&&y<h*0.37){ pa.setX(q,pa.getX(q)*(1.15+rnd()*0.2)); pa.setZ(q,pa.getZ(q)*(1.15+rnd()*0.2)); } } g.computeVertexNormals(); const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:col,flatShading:true,fog:false})); m.position.set(x,h/2-2,z); m.rotation.y=rnd()*3; scene.add(m); };
  const cols=[0x6fae84,0x7dba8c,0x5f9f78,0x86bf96];
  for(let k=0;k<11;k++) mt(BX0-420-rnd()*260, BZ0+k*150-150, 140+rnd()*90, 150+rnd()*170, pick(cols)); // 西：青山
  for(let k=0;k<9;k++) mt(BX0-200+k*150, BZ0-480-rnd()*240, 150+rnd()*90, 120+rnd()*160, pick(cols)); // 北
  for(let k=0;k<11;k++) mt(BX1+440+rnd()*260, BZ0+k*150-120, 140+rnd()*90, 130+rnd()*170, pick(cols)); // 東：九逕山
  mt(BX0-520,BZ0+700,260,380,0x5f9f78); // 青山主峰
  const hedge=[]; for(let x=BX0;x<=BX1;x+=6){ hedge.push([x,BZ0-3,0,0],[x,BZ1+3,0,0]); } for(let z=BZ0;z<=BZ1;z+=6){ hedge.push([BX0-3,z,0,0],[BX1+3,z,0,0]); }
  props.tree.push(...hedge.filter(([x,z])=>!(cellAt(x,z)&1)&&!(cellAt(x+4,z)&1)&&!(cellAt(x-4,z)&1)&&!(cellAt(x,z+4)&1)&&!(cellAt(x,z-4)&1)));
}
farScene(); flushBuckets();

/* ---------- 清走壓住馬路嘅街道物件（樹、街燈） ---------- */
const offRoad=(x,z,r)=>{ for(const [dx,dz] of [[0,0],[r,0],[-r,0],[0,r],[0,-r]]) if(cellAt(x+dx,z+dz)&1) return false; return true; };
props.tree=props.tree.filter(([x,z])=>offRoad(x,z,1.6)&&ELEV(x,z,15)<0.2); props.lamp=props.lamp.filter(([x,z])=>offRoad(x,z,0.8)&&ELEV(x,z,15)<0.2);
/* ---------- 街道物件 ---------- */
// 分區 instancing：每 200 米一格，各自有包圍球，鏡頭睇唔到嘅格就唔畫
const INSTC=[]; // 分區 instancing 清單（遠距離唔畫）
function instanced(geo,mat,list,place,cast=true,far=320){ if(!list.length) return; const groups=new Map();
  list.forEach(it=>{ const k=Math.floor(it[0]/CHUNK)+','+Math.floor(it[1]/CHUNK); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(it); });
  if(!geo.boundingSphere) geo.computeBoundingSphere(); const gr=geo.boundingSphere.radius+geo.boundingSphere.center.length();
  groups.forEach(items=>{ const g=geo.clone(); const m=new THREE.InstancedMesh(g,mat,items.length); const o=new THREE.Object3D(); const bb=new THREE.Box3();
    items.forEach((it,k)=>{ o.position.set(0,0,0); o.rotation.set(0,0,0); o.scale.set(1,1,1); place(o,it); o.updateMatrix(); m.setMatrixAt(k,o.matrix); bb.expandByPoint(o.position); });
    const sp=new THREE.Sphere(); bb.getBoundingSphere(sp); sp.radius+=gr*2; g.boundingSphere=sp;   // 用成格嘅包圍球做 culling
    m.castShadow=cast; m.receiveShadow=true; m.matrixAutoUpdate=false; scene.add(m); INSTC.push({m,c:sp.center,r:sp.radius,far}); }); }
const tl=props.tree.filter(([x,z])=>offRoad(x,z,1.6));
instanced(new THREE.CylinderGeometry(0.25,0.35,2.2,5,1,true),M(C.trunk),tl,(o,[x,z,,y=0.3])=>o.position.set(x,y+1.1,z),false);
instanced(new THREE.IcosahedronGeometry(1.9,0),M(C.tree,{r:0.9}),tl,(o,[x,z,,y=0.3])=>{o.position.set(x,y+3.2,z);o.scale.setScalar(0.85+((Math.abs(x*13+z*7))%10)/25);});
instanced(new THREE.CylinderGeometry(0.12,0.16,6,6),M(0x6b7380),props.lamp,(o,[x,z])=>o.position.set(x,3.2,z),false);
instanced(new THREE.BoxGeometry(0.5,0.3,1.8),M(0xfff6c4,{e:0x555533}),props.lamp,(o,[x,z,a])=>{o.position.set(x+Math.sin(a)*0.8,6.1,z+Math.cos(a)*0.8);o.rotation.y=a;},false);
/* ---------- 精細／超精細模式：行人路欄杆、街道設施、霓虹招牌、雨篷、冷氣機、天台水缸 ----------
   全部砌入分區合併網格（每 200 米一格），一格只係幾次繪製；鏡頭睇唔到嘅格唔畫，唔投影。 */
const NEON=(()=>{ if(!GFX) return null;
  const SC0=scene.children.length;   // 之後加入嘅分區網格：遠距離自動唔畫
  const G2=GFX>=2;
  /* ===== 顏色方塊（vertex color）分區桶 ===== */
  const VB=new Map(), _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _v=new THREE.Vector3(), _s=new THREE.Vector3(), _c=new THREE.Color(), _n=new THREE.Vector3(), _nm=new THREE.Matrix3();
  const TPL={box:new THREE.BoxGeometry(1,1,1).toNonIndexed(), cyl:new THREE.CylinderGeometry(1,1,1,8).toNonIndexed(), cyl12:new THREE.CylinderGeometry(1,1,1,12).toNonIndexed()};
  const ck=(x,z)=>Math.floor(x/CHUNK)+','+Math.floor(z/CHUNK);
  function put(shape,x,y,z,sx,sy,sz,yaw,hex,pitch=0,roll=0){ let b=VB.get(ck(x,z)); if(!b){ b={p:[],n:[],c:[]}; VB.set(ck(x,z),b); } putB(b,shape,x,y,z,sx,sy,sz,yaw,hex,pitch,roll); }
  function putB(b,shape,x,y,z,sx,sy,sz,yaw,hex,pitch=0,roll=0){
    const T=TPL[shape], P=T.attributes.position, N=T.attributes.normal; _e.set(pitch,yaw,roll,'YXZ'); _q.setFromEuler(_e); _m.compose(_v.set(x,y,z),_q,_s.set(sx,sy,sz)); _nm.getNormalMatrix(_m); _c.setHex(hex);
    for(let i=0;i<P.count;i++){ _v.set(P.getX(i),P.getY(i),P.getZ(i)).applyMatrix4(_m); b.p.push(_v.x,_v.y,_v.z); _n.set(N.getX(i),N.getY(i),N.getZ(i)).applyMatrix3(_nm).normalize(); b.n.push(_n.x,_n.y,_n.z); b.c.push(_c.r,_c.g,_c.b); } }
  const box=(...a)=>put('box',...a), cyl=(x,y,z,r,h,hex,seg)=>put(seg?'cyl12':'cyl',x,y,z,r,h,r,0,hex);
  /* ===== 貼圖四邊形分區桶（欄杆、霓虹） ===== */
  function QB(){ const m=new Map(); return {m,add(x,z,P,U,N){ let b=m.get(ck(x,z)); if(!b){ b={p:[],u:[],n:[]}; m.set(ck(x,z),b); } b.p.push(...P); b.u.push(...U); b.n.push(...N); }}; }
  // 一塊豎立四邊形：由 A 到 B（水平），y0→y1，uv 由 [u0,v0]→[u1,v1]
  function quad(qb,A,B,y0,y1,u0,v0,u1,v1,nx,nz){ qb.add((A[0]+B[0])/2,(A[1]+B[1])/2,
    [A[0],y0,A[1], B[0],y0,B[1], B[0],y1,B[1], A[0],y0,A[1], B[0],y1,B[1], A[0],y1,A[1]],
    [u0,v0, u1,v0, u1,v1, u0,v0, u1,v1, u0,v1], [nx,0,nz,nx,0,nz,nx,0,nz,nx,0,nz,nx,0,nz,nx,0,nz]); }
  const off=(x,z)=>ELEV(x,z,12)>0.2;
  // 沿住同一條路（跨幾段）每隔一段距離做一次：馬路係一段段短線，所以要將距離帶落下一段
  const CARRY=new Map(); function every(key,L,sp,fn){ let s=CARRY.has(key)?CARRY.get(key):sp*drnd(); for(;s<L;s+=sp*(0.7+0.6*drnd())) fn(s); CARRY.set(key,s-L); }
  const nearRoad=(x,z)=>cellAt(x,z)&1;

  /* ===== 1. 巴士站（大路，行人路上） ===== */
  const STOPS=[]; const lampNear=(x,z,r)=>props.lamp.some(([lx,lz])=>Math.abs(lx-x)<r&&Math.abs(lz-z)<r);
  MAP.roads.forEach((r,ri)=>{ if(r.bridge||r.elev||r.t==='street') return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B); const side=ri%2?1:-1, nx=uz*side, nz=-ux*side;
    every('bus'+r.name+side,L,G2?200:260,s=>{ if(s<(DEG[a]>=3?NW[a]+10:3)||s>L-(DEG[b]>=3?NW[b]+10:3)) return; const o=r.w/2+2.4, x=A[0]+ux*s+nx*o, z=A[1]+uz*s+nz*o; if(off(x,z)||nearRoad(x+nx*1.4,z+nz*1.4)||nearRoad(x,z)||lampNear(x,z,2.6)) return;
      const yaw=Math.atan2(nx,nz); STOPS.push([x,z,nx,nz,ux,uz]);
      box(x,2.75,z, 4.4,0.16,1.9, yaw,0xc9d1d9); box(x+nx*0.75,1.4,z+nz*0.75, 4.2,2.3,0.06, yaw,0x9fc3d6);   // 頂、背板（玻璃）
      for(const k of [-2,2]) box(x+ux*k+nx*0.8,1.38,z+uz*k+nz*0.8, 0.12,2.76,0.12, yaw,0x6c757d);
      box(x+nx*0.45,0.55,z+nz*0.45, 2.6,0.12,0.45, yaw,0x8d99ae);
      const px=x-nx*0.9+ux*3, pz=z-nz*0.9+uz*3; box(px,1.5,pz,0.1,3,0.1,0,0x6c757d); box(px,3.0,pz,0.7,0.5,0.06,yaw,0xd62828); box(px,2.55,pz,0.7,0.35,0.07,yaw,0xf8f9fa); }); });
  /* ===== 2. 行人路欄杆（灰色鐵欄，路口、斑馬線、車道、巴士站、上落客位留空） ===== */
  const railTex=canvasTex(64,32,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#fff'; for(let x=2;x<w;x+=8) g.fillRect(x,0,4,h); });
  const RCOL=0x9ea7af, PANEL=2.5;
  const gaps=[]; MAP.crossings.forEach(c=>gaps.push([c.p[0],c.p[1],c.half+2.2])); STOPS.forEach(([x,z])=>gaps.push([x,z,4.2]));
  Object.values(LMK).forEach(v=>{ if(v&&v.stop) gaps.push([v.stop[0],v.stop[1],9]); if(v&&v.pos) gaps.push([v.pos[0],v.pos[1],10]); });
  const inGap=(x,z)=>gaps.some(([gx,gz,r])=>(gx-x)*(gx-x)+(gz-z)*(gz-z)<r*r);
  let panels=0; const RAILS=[];
  MAP.roads.forEach(r=>{ if(r.bridge||r.elev) return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B);
    [1,-1].forEach(side=>{ const nx=uz*side, nz=-ux*side, o=r.w/2+0.32; const s0=DEG[a]>=3?NW[a]+3.4:DEG[a]===2?0.2:1, s1=L-(DEG[b]>=3?NW[b]+3.4:DEG[b]===2?0.2:1); let run=0;
      for(let s=s0;s+PANEL<=s1;s+=PANEL){ const sm=s+PANEL/2, x=A[0]+ux*sm+nx*o, z=A[1]+uz*sm+nz*o;
        const drive=nearRoad(x+nx*1.2,z+nz*1.2)||nearRoad(x+nx*2.6,z+nz*2.6)||nearRoad(x+nx*0.7,z+nz*0.7);
        if(drive||inGap(x,z)||off(x,z)||cellAt(x,z)&4||(++run%10===0)){ continue; }
        const P=[A[0]+ux*s+nx*o,A[1]+uz*s+nz*o], Q=[A[0]+ux*(s+PANEL)+nx*o,A[1]+uz*(s+PANEL)+nz*o], yaw=Math.atan2(ux,uz);
        RAILS.push({x,z,P,Q,yaw,nx,nz,k:ck(x,z),dead:false}); panels++; } }); });
  /* ===== 3. 街道設施：消防栓、郵筒、垃圾桶、花槽、沙井蓋 ===== */
  MAP.roads.forEach(r=>{ if(r.bridge||r.elev) return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B);
    [1,-1].forEach(side=>{ const nx=uz*side, nz=-ux*side;
      const at=(s,o)=>[A[0]+ux*s+nx*(r.w/2+o),A[1]+uz*s+nz*(r.w/2+o)], ok=(x,z)=>!off(x,z)&&!nearRoad(x,z)&&!(cellAt(x,z)&(2|4))&&!lampNear(x,z,1.4)&&!inGap(x,z);
      every('hy'+r.name+side,L,70,s=>{ const [x,z]=at(s,0.95); if(!ok(x,z)) return; cyl(x,0.45,z,0.2,0.8,0xf2c230); cyl(x,0.9,z,0.24,0.14,0xd62828); cyl(x,1.02,z,0.13,0.14,0xd62828); box(x,0.6,z,0.56,0.12,0.12,Math.atan2(ux,uz),0xd62828); });   // 消防栓
      every('pb'+r.name+side,L,190,s=>{ const [x,z]=at(s,2.7); if(!ok(x,z)) return; cyl(x,0.65,z,0.32,1.3,0x2d7a3a,1); cyl(x,1.33,z,0.34,0.08,0x23602e,1); box(x-nx*0.3,1.05,z-nz*0.3,0.32,0.06,0.06,Math.atan2(nx,nz),0x111111); });   // 郵筒
      every('bin'+r.name+side,L,G2?45:70,s=>{ const [x,z]=at(s,2.8); if(!ok(x,z)) return; box(x,0.55,z,0.55,1.1,0.55,Math.atan2(ux,uz),drnd()<0.5?0xff8c1a:0x2a9d4a); box(x,1.13,z,0.62,0.08,0.62,Math.atan2(ux,uz),0x333333); });   // 垃圾桶
      if(G2) every('pl'+r.name+side,L,40,s=>{ const [x,z]=at(s,2.85); if(!ok(x,z)) return; const y=Math.atan2(ux,uz); box(x,0.35,z,0.75,0.7,1.8,y,0xbdb5a6); box(x,0.75,z,0.6,0.2,1.65,y,0x4f9d3a); });   // 花槽
      if(side>0) every('mh'+r.name,L,45,s=>{ const lo=r.w/4*(drnd()<0.5?1:-1), x=A[0]+ux*s+uz*lo, z=A[1]+uz*s-ux*lo; if(off(x,z)) return; cyl(x,0.045,z,0.42,0.03,0x3d4148,1); }); }); });   // 沙井蓋
  /* ===== 4. 樓宇門面：雨篷、冷氣機、晾衫竹、天台水缸、霓虹招牌 ===== */
  // 霓虹招牌貼圖集：2048×2048；上面三行係 8×3 個直招牌（256×512），最底一行係 4×2 個橫招牌（512×256）
  const NAMES=['鴻運酒家','金鳳茶樓','大押','東方大藥房','合興金行','祥記粥麵','百樂桌球','明珠珠寶','新華戲院','好運麻雀','龍鳳酒樓','福臨海鮮','永利找換','利源錶行','德記涼茶','發記燒味','九龍賓館','華豐眼鏡','美華影樓','鴻興跌打','大華電器','金城冰室','恆昌當舖','寶華旅館'];
  const HN=['金鳳大酒樓','東方大藥房','百樂桌球會','明珠珠寶金行','合興找換店','福臨海鮮酒家','新華大戲院','鴻運卡拉OK'];
  const NCOL=['#ff2e63','#08f7fe','#ffe700','#39ff14','#ff6b00','#fe53bb','#f5d300','#00e5ff','#ff3131','#b026ff'];
  const BG=['#140a12','#0d1424','#1a0d0d','#101810','#1b1027','#22140a'];
  const cellRect=i=>i<24?[(i%8)*256,Math.floor(i/8)*512,256,512]:[((i-24)%4)*512,1536+Math.floor((i-24)/4)*256,512,256];
  function drawSign(g,i,glow){ const [x,y,w,h]=cellRect(i), vert=i<24, t=vert?NAMES[i]:HN[i-24]; const ca=NCOL[(i*3)%NCOL.length], cb=NCOL[(i*7+4)%NCOL.length];
    if(!glow){ g.fillStyle=BG[i%BG.length]; g.fillRect(x+4,y+4,w-8,h-8); g.fillStyle='#3a3a3a'; g.fillRect(x,y,w,4); g.fillRect(x,y+h-4,w,4); g.fillRect(x,y,4,h); g.fillRect(x+w-4,y,4,h); }
    else { g.fillStyle='#000'; g.fillRect(x,y,w,h); g.save(); g.beginPath(); g.rect(x,y,w,h); g.clip(); const k=1/(1+2*GM); g.translate(x+w/2,y+h/2); g.scale(k,k); g.translate(-(x+w/2),-(y+h/2)); }
    g.save(); g.shadowColor=ca; g.shadowBlur=glow?26:12; g.strokeStyle=ca; g.lineWidth=glow?12:6; rr(g,x+16,y+16,w-32,h-32,18); g.stroke();
    if(i%3===0){ g.lineWidth=glow?8:3; g.strokeStyle=cb; g.shadowColor=cb; rr(g,x+30,y+30,w-60,h-60,12); g.stroke(); }
    if(!glow){ g.shadowBlur=0; g.strokeStyle='rgba(255,255,255,.75)'; g.lineWidth=1.5; rr(g,x+16,y+16,w-32,h-32,18); g.stroke(); g.shadowBlur=12; }
    g.fillStyle=cb; g.shadowColor=cb; g.textAlign='center'; g.textBaseline='middle';
    const ch=[...t];
    if(t==='大押'){ g.font='bold 150px sans-serif'; g.beginPath(); g.arc(x+w/2,y+h*0.62,92,0,6.3); g.lineWidth=glow?14:7; g.strokeStyle=cb; g.stroke(); g.fillText('押',x+w/2,y+h*0.63); g.font='bold 70px sans-serif'; g.fillText('大',x+w/2,y+h*0.2); }   // 當舖：蝠鼠銅錢
    else if(vert){ const n=ch.length, fs=Math.min(120,(h-80)/n*0.92); g.font='bold '+fs+'px sans-serif'; ch.forEach((c,k)=>g.fillText(c,x+w/2,y+h/2+(k-(n-1)/2)*fs*1.05)); if(!glow){ g.shadowBlur=0; g.fillStyle='rgba(255,255,255,.55)'; ch.forEach((c,k)=>g.fillText(c,x+w/2,y+h/2+(k-(n-1)/2)*fs*1.05)); } }
    else { let fs=110; g.font='bold '+fs+'px sans-serif'; while(g.measureText(t).width>w-70&&fs>30){ fs-=4; g.font='bold '+fs+'px sans-serif'; } g.fillText(t,x+w/2,y+h/2+4); if(!glow){ g.shadowBlur=0; g.fillStyle='rgba(255,255,255,.5)'; g.fillText(t,x+w/2,y+h/2+4); } }
    g.restore(); if(glow) g.restore(); }
  const GM=0.14;   // 光暈塊每邊大 14%，光暈貼圖入面嘅內容就縮細返同一比例，對齊招牌
  const atlas=canvasTex(2048,2048,(g)=>{ g.fillStyle='#222'; g.fillRect(0,0,2048,2048); for(let i=0;i<32;i++) drawSign(g,i,false); g.fillStyle='#2f3337'; g.fillRect(2040,2040,8,8); },false);
  const glowT=canvasTex(512,512,(g)=>{ g.scale(0.25,0.25); for(let i=0;i<32;i++) drawSign(g,i,true); },false);
  atlas.anisotropy=8; atlas.generateMipmaps=true;
  const SIGNQ=QB(), GLOWQ=QB(), FSQ=QB(), FGQ=QB();   // 一般招牌、閃爍招牌、落雨地面倒影
  // 倒影：用一條柔和光帶貼圖（中間光、邊位淡出），按招牌字色上色
  const REFB=new Map(); const _rc=new THREE.Color();
  function rquad(C0,C1,C2,C3,y,hex){ const k=ck((C0[0]+C2[0])/2,(C0[1]+C2[1])/2); let b=REFB.get(k); if(!b){ b={p:[],u:[],c:[]}; REFB.set(k,b); } _rc.set(hex);
    b.p.push(C0[0],y,C0[1], C1[0],y,C1[1], C2[0],y,C2[1], C0[0],y,C0[1], C2[0],y,C2[1], C3[0],y,C3[1]); b.u.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1); for(let q=0;q<6;q++) b.c.push(_rc.r,_rc.g,_rc.b); }
  const refCol=i=>NCOL[(i*7+4)%NCOL.length];
  function gquad(qb,C0,C1,C2,C3,y,u0,v0,u1,v1){ qb.add((C0[0]+C2[0])/2,(C0[1]+C2[1])/2,[C0[0],y,C0[1], C1[0],y,C1[1], C2[0],y,C2[1], C0[0],y,C0[1], C2[0],y,C2[1], C3[0],y,C3[1]],[u0,v1, u1,v1, u1,v0, u0,v1, u1,v0, u0,v0],[0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0]); }
  let nFlick=0; const flick=()=>{ const f=drnd()<0.045; if(f) nFlick++; return f; }; const DK=[2043/2048,1-2043/2048];   // 深色角落（框邊用）
  const UV=(i,flip)=>{ const [x,y,w,h]=cellRect(i); let u0=x/2048,u1=(x+w)/2048; if(flip){ const t=u0; u0=u1; u1=t; } return [u0,1-(y+h)/2048,u1,1-y/2048]; };
  let nSigns=0;
  // 直招牌：垂直於外牆凸出（兩面都讀得正），連鐵架
  function vSign(fx,fz,ox,oz,y0,len,ht,i){ // fx,fz：外牆位置；ox,oz：向街方向
    const P=[fx+ox*0.35,fz+oz*0.35], Q=[fx+ox*(0.35+len),fz+oz*(0.35+len)], tx=-oz, tz=ox; const t=0.12;
    const Pa=[P[0]+tx*t,P[1]+tz*t], Qa=[Q[0]+tx*t,Q[1]+tz*t], Pb=[P[0]-tx*t,P[1]-tz*t], Qb=[Q[0]-tx*t,Q[1]-tz*t];
    const [a0,b0,a1,b1]=UV(i,false), [c0,d0,c1,d1]=UV(i,true); const fl=flick(), SIGNQ_=fl?FSQ:SIGNQ, GLOWQ_=fl?FGQ:GLOWQ;
    // 直招牌貼圖係「直」嘅：旋轉 90°（u 沿高度）唔使，因為 cell 本身係 256×512 豎直，quad 闊 len 高 ht
    quad(SIGNQ_,Qa,Pa,y0,y0+ht,a0,b0,a1,b1,tx,tz); quad(SIGNQ_,Pb,Qb,y0,y0+ht,a0,b0,a1,b1,-tx,-tz);
    quad(SIGNQ,Qb,Qa,y0,y0+ht,DK[0],DK[1],DK[0],DK[1],ox,oz);
    const g=len*GM, gy=ht*GM; const Ga=[Pa[0]+tx*0.02-ox*g,Pa[1]+tz*0.02-oz*g], Gb=[Qa[0]+tx*0.02+ox*g,Qa[1]+tz*0.02+oz*g], Ha=[Pb[0]-tx*0.02-ox*g,Pb[1]-tz*0.02-oz*g], Hb=[Qb[0]-tx*0.02+ox*g,Qb[1]-tz*0.02+oz*g];
    const [e0,f0,e1,f1]=UV(i,false); quad(GLOWQ_,Gb,Ga,y0-gy,y0+ht+gy,e0,f0,e1,f1,tx,tz); quad(GLOWQ_,Ha,Hb,y0-gy,y0+ht+gy,e0,f0,e1,f1,-tx,-tz);
    { const w=0.75, W0=[fx+ox*0.3-tx*w,fz+oz*0.3-tz*w], W1=[fx+ox*0.3+tx*w,fz+oz*0.3+tz*w], e=len+7; rquad(W0,W1,[W1[0]+ox*e,W1[1]+oz*e],[W0[0]+ox*e,W0[1]+oz*e],0.14,refCol(i)); }   // 落雨地面倒影
    const yaw=Math.atan2(ox,oz); for(const yy of [y0+ht-0.3,y0+0.3]) box(fx+ox*0.2,yy,fz+oz*0.2,0.06,0.06,0.5,yaw,0x2b2d33);   // 鐵架
    nSigns++; }
  // 橫招牌：貼住外牆
  function hSign(A,B,ox,oz,y0,ht,i){ const P=[A[0]+ox*0.14,A[1]+oz*0.14], Q=[B[0]+ox*0.14,B[1]+oz*0.14]; const [a0,b0,a1,b1]=UV(i,false); const fl=flick();
    quad(fl?FSQ:SIGNQ,P,Q,y0,y0+ht,a0,b0,a1,b1,ox,oz);
    rquad(P,Q,[Q[0]+ox*6,Q[1]+oz*6],[P[0]+ox*6,P[1]+oz*6],0.14,refCol(i));
    const gx=(Q[0]-P[0])*GM, gz=(Q[1]-P[1])*GM, gy=ht*GM;
    quad(fl?FGQ:GLOWQ,[P[0]-gx+ox*0.03,P[1]-gz+oz*0.03],[Q[0]+gx+ox*0.03,Q[1]+gz+oz*0.03],y0-gy,y0+ht+gy,a0,b0,a1,b1,ox,oz); nSigns++; }
  const vIdx=()=>drnd()*24|0, hIdx=()=>24+(drnd()*8|0);
  DFRONT.forEach(F=>{ const [A,B]=[F.c[0],F.c[1]], D=F.c[3]; const ex=B[0]-A[0], ez=B[1]-A[1], W=Math.hypot(ex,ez); if(W<4) return; const ux=ex/W, uz=ez/W;
    let ox=A[0]-D[0], oz=A[1]-D[1]; const ol=Math.hypot(ox,oz)||1; ox/=ol; oz/=ol;   // 向街
    if(off(A[0],A[1])) return;
    const at=(s,o=0)=>[A[0]+ux*s+ox*o,A[1]+uz*s+oz*o], yaw=Math.atan2(ux,uz);
    // 雨篷（舖頭上面）
    const nU=Math.max(1,Math.round(W/6)), uw=W/nU;
    for(let k=0;k<nU;k++){ if(drnd()<0.25) continue; const [x,z]=at(uw*(k+0.5),0.75); box(x,3.75,z,uw-0.4,0.12,1.5,yaw,dpick([0xd62828,0x2a9d8f,0xf4a261,0x457b9d,0xe9c46a,0x6a4c93,0x2b9348,0xf1faee]),-0.28); }
    // 地舖門口雜物（超精細）
    if(G2) for(let k=0;k<nU;k++){ if(drnd()<0.5) continue; const [x,z]=at(uw*(k+0.3+drnd()*0.4),0.7); if(drnd()<0.5){ for(let q=0;q<3;q++) box(x+ux*q*0.55,0.28+(q%2)*0.3,z+uz*q*0.55,0.5,0.28,0.4,yaw,dpick([0xe63946,0xffb703,0x2a9d8f,0xf77f00])); }
      else { box(x,0.24,z,0.42,0.48,0.42,yaw,dpick([0xd62828,0x1d4ed8,0x16a34a])); } }
    const tall=F.type!=='estate'&&F.h>6;
    // 冷氣機、晾衫竹（唐樓／舊樓上面幾層）
    if(tall){ for(let y=5.8;y<F.h-1.5;y+=3) for(let s=1.2;s<W-1;s+=2.2){ const q=drnd(); if(q<(G2?0.42:0.26)){ const [x,z]=at(s,0.32); box(x,y,z,0.85,0.55,0.45,yaw,q<0.1?0xcfd4da:0xeef0f2); box(x+ox*0.23,y,z+oz*0.23,0.6,0.38,0.02,yaw,0x9aa1a9); }
        else if(G2&&q>0.9){ const [x,z]=at(s,0.2), py=Math.atan2(ox,oz); for(const d of [-0.45,0.45]){ const px=x+ux*d, pz=z+uz*d; box(px+ox*0.75,y+0.95,pz+oz*0.75,0.05,0.05,1.5,py,0x9c7a4f);   // 晾衫竹：由窗口伸出
            for(let c=0;c<3;c++){ if(drnd()<0.25) continue; const cx=px+ox*(0.35+c*0.42), cz=pz+oz*(0.35+c*0.42); box(cx,y+0.6,cz,0.03,0.66,0.34,py,dpick([0xffffff,0x4cc9f0,0xf72585,0xffd166,0x90be6d,0x8d99ae,0xe63946])); } } } }
      // 天台水缸、樓梯屋、天線
      const cx=(F.c[0][0]+F.c[2][0])/2, cz=(F.c[0][1]+F.c[2][1])/2;
      if(drnd()<0.75){ cyl(cx+ux*1.5,F.h+0.85,cz+uz*1.5,0.85,1.6,dpick([0xdfe7ee,0x5fa8d3,0xf1f1f1])); box(cx-ux*2,F.h+1.2,cz-uz*2,2.2,2.4,2.4,yaw,0xcfc8bb); }
      if(G2&&drnd()<0.5) box(cx-ux*2,F.h+3.6,cz-uz*2,0.06,2.6,0.06,0,0x555b63); }
    // 霓虹招牌：直招牌喺 5–12 米高（超精細有上下兩層），橫招牌貼外牆
    if(F.type!=='estate'){ const step=G2?3.6:5.2;
      for(let s=1.6;s<W-1.2;s+=step+drnd()*2){ if(drnd()<(G2?0.2:0.4)) continue; const fx=A[0]+ux*s, fz=A[1]+uz*s; const len=1.5+drnd()*1.2, ht=Math.min(F.h-5.2,3.2+drnd()*4); if(ht<2.2) continue;
        vSign(fx,fz,ox,oz,5.0+drnd()*1.2,len,ht,vIdx());
        if(G2&&F.h>15&&drnd()<0.45){ const h2=2.4+drnd()*2.6; if(5+ht+1.4+h2<F.h) vSign(fx+ux*1.2,fz+uz*1.2,ox,oz,5+ht+1.2,len*0.8,h2,vIdx()); } }
      if(F.type==='shops'||G2&&drnd()<0.4){ const s0=W*0.1+drnd()*W*0.2, w=Math.min(W*0.7,4+drnd()*4); hSign(at(s0),at(s0+w),ox,oz,4.95,Math.min(1.6,w*0.32),hIdx()); } }
    else if(drnd()<(G2?0.8:0.5)){ const s0=W*0.2, w=Math.min(W*0.6,10); hSign(at(s0),at(s0+w),ox,oz,3.4,1.25,hIdx()); }   // 屋苑商場平台
  });
  /* ===== 出網格 ===== */
  const VMAT=new THREE.MeshLambertMaterial({vertexColors:true});
  VB.forEach(b=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3)); g.computeBoundingSphere();
    const m=new THREE.Mesh(g,VMAT); m.receiveShadow=true; m.matrixAutoUpdate=false; scene.add(m); });
  const qmesh=(qb,mat,ro)=>qb.m.forEach(b=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2)); g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat); m.matrixAutoUpdate=false; if(ro) m.renderOrder=ro; scene.add(m); });
  /* 欄杆：每格兩個網格（鐵枝貼圖＋柱同扶手），可以喺遊戲中途剪開（例如救護車要駛出車道、病人位置） */
  const RIM=new THREE.MeshLambertMaterial({map:railTex,color:RCOL,alphaTest:0.5,side:THREE.DoubleSide}), RCH=new Map();
  RAILS.forEach(p=>{ let c=RCH.get(p.k); if(!c){ c={ps:[],ms:[]}; RCH.set(p.k,c); } c.ps.push(p); });
  function railBuild(k){ const c=RCH.get(k); if(!c) return; c.ms.forEach(m=>{ scene.remove(m); m.geometry.dispose(); }); c.ms.length=0;
    const q=QB(), b={p:[],n:[],c:[]}; c.ps.forEach(p=>{ if(p.dead) return; quad(q,p.P,p.Q,0.32,1.0,0,0,PANEL*1.6,1,p.nx,p.nz);
      putB(b,'box',p.x,1.06,p.z,0.07,0.07,PANEL,p.yaw,RCOL); putB(b,'box',p.x,0.3,p.z,0.05,0.05,PANEL,p.yaw,RCOL); putB(b,'box',p.P[0],0.58,p.P[1],0.09,1.16,0.09,p.yaw,RCOL); putB(b,'box',p.Q[0],0.58,p.Q[1],0.09,1.16,0.09,p.yaw,RCOL); });
    q.m.forEach(v=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(v.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(v.n,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(v.u,2)); g.computeBoundingSphere(); const m=new THREE.Mesh(g,RIM); m.matrixAutoUpdate=false; scene.add(m); c.ms.push(m); });
    if(b.p.length){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3)); g.computeBoundingSphere(); const m=new THREE.Mesh(g,VMAT); m.receiveShadow=true; m.matrixAutoUpdate=false; scene.add(m); c.ms.push(m); } }
  RCH.forEach((c,k)=>railBuild(k));
  const segD2=(px,pz,A,B)=>{ const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; let t=((px-A[0])*dx+(pz-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); const qx=A[0]+dx*t-px,qz=A[1]+dz*t-pz; return qx*qx+qz*qz; };
  const crossP=(a,b,c,d)=>{ const r=[b[0]-a[0],b[1]-a[1]], s=[d[0]-c[0],d[1]-c[1]], den=r[0]*s[1]-r[1]*s[0]; if(Math.abs(den)<1e-9) return null; const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den, u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den; return t>=0&&t<=1&&u>=0&&u<=1?[a[0]+r[0]*t,a[1]+r[1]*t]:null; };
  function cut(test){ const ks=new Set(); RAILS.forEach(p=>{ if(!p.dead&&test(p)){ p.dead=true; ks.add(p.k); } }); ks.forEach(railBuild); return ks.size; }
  const RAILAPI={
    cutSeg(A,B,r){ return cut(p=>segD2(p.x,p.z,A,B)<r*r); },   // 一條線兩邊 r 米內嘅欄杆拆走
    cutPath(pts,r=3.5){ const hits=[]; for(let i=1;i<pts.length;i++){ const A=pts[i-1],B=pts[i], x0=Math.min(A[0],B[0])-3,x1=Math.max(A[0],B[0])+3,z0=Math.min(A[1],B[1])-3,z1=Math.max(A[1],B[1])+3;
        RAILS.forEach(p=>{ if(p.dead||p.x<x0||p.x>x1||p.z<z0||p.z>z1) return; const h=crossP(A,B,p.P,p.Q); if(h) hits.push(h); }); }
      return hits.length?cut(p=>hits.some(h=>(p.x-h[0])**2+(p.z-h[1])**2<r*r)):0; },   // 路線穿過欄杆嘅位：前後各 r 米拆走
    cutPts(list,r){ return cut(p=>list.some(q=>(p.x-q[0])**2+(p.z-q[1])**2<r*r)); },
    blockedSeg(A,B){ for(const p of RAILS){ if(!p.dead&&crossP(A,B,p.P,p.Q)) return true; } return false; },
    hits(pts){ let n=0; for(let i=1;i<pts.length;i++) for(const p of RAILS) if(!p.dead&&crossP(pts[i-1],pts[i],p.P,p.Q)) n++; return n; } };
  window.__RAIL=RAILAPI;
  // 救護站、醫院同其他地標：由車位／停車點拉一條線去最近嘅馬路，兩邊留空
  const nearRoadPt=(x,z)=>{ let best=null,bd=1e9; MAP.roads.forEach(r=>{ if(r.elev) return; const A=NODES[r.n[0]],B=NODES[r.n[1]]; const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; let t=((x-A[0])*dx+(z-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); const px=A[0]+dx*t,pz=A[1]+dz*t, d=(px-x)**2+(pz-z)**2; if(d<bd){ bd=d; best=[px,pz]; } }); return best; };
  Object.values(LMK).forEach(v=>{ if(!v||Array.isArray(v)) return; if(v.pos){ const q=nearRoadPt(v.pos[0],v.pos[1]); if(q) RAILAPI.cutSeg(v.pos,q,6); }
    if(v.stop&&v.patient){ RAILAPI.cutSeg(v.stop,v.patient,2.5); RAILAPI.cutPath([v.stop,v.patient],3); } if(v.stop&&v.door){ RAILAPI.cutSeg(v.stop,v.door,3); RAILAPI.cutPath([v.stop,v.door],3); } });
  const SMAT=new THREE.MeshBasicMaterial({map:atlas,color:0xbdbdbd});
  const GMAT=new THREE.MeshBasicMaterial({map:glowT,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0,side:THREE.DoubleSide});
  qmesh(SIGNQ,SMAT); qmesh(GLOWQ,GMAT,2);
  // 閃爍招牌（舊光管接觸唔良）：兩組，各自一個材質
  const FS=[SMAT.clone(),SMAT.clone()], FG=[GMAT.clone(),GMAT.clone()]; let fk=0;
  [[FSQ,FS],[FGQ,FG]].forEach(([q,ms],gi)=>q.m.forEach(b=>{ const k=fk++%2; const one=QB(); one.m.set('x',b); qmesh(one,ms[k],gi?2:0); }));
  const RMAT=new THREE.MeshBasicMaterial({map:glowT,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0,polygonOffset:true,polygonOffsetFactor:-2}); RMAT.visible=false;
  RMAT.map=canvasTex(64,128,(g,w,h)=>{ const gx=g.createLinearGradient(0,0,w,0); gx.addColorStop(0,'rgba(255,255,255,0)'); gx.addColorStop(0.5,'rgba(255,255,255,1)'); gx.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gx; g.fillRect(0,0,w,h);
    g.globalCompositeOperation='destination-in'; const gy=g.createLinearGradient(0,0,0,h); gy.addColorStop(0,'rgba(0,0,0,0)'); gy.addColorStop(0.75,'rgba(0,0,0,.8)'); gy.addColorStop(1,'rgba(0,0,0,1)'); g.fillStyle=gy; g.fillRect(0,0,w,h);
    g.globalCompositeOperation='source-over'; g.fillStyle='rgba(0,0,0,.35)'; for(let y=0;y<h;y+=5) g.fillRect(0,y,w,2); },false);   // 橫向水紋
  RMAT.vertexColors=true; RMAT.needsUpdate=true;
  REFB.forEach(b=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2)); g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3)); g.computeBoundingSphere(); const m=new THREE.Mesh(g,RMAT); m.matrixAutoUpdate=false; m.renderOrder=1; scene.add(m); });
  const DC=scene.children.slice(SC0).filter(o=>o.isMesh&&o.geometry).map(m=>{ m.geometry.computeBoundingSphere(); return {m,c:m.geometry.boundingSphere.center.clone(),r:m.geometry.boundingSphere.radius}; });
  let DCT=0; const DLIM=G2?240:200;
  const dcull=(t)=>{ if(t-DCT<0.4) return; DCT=t; const px=cam.position.x, pz=cam.position.z; for(const d of DC){ const dd=Math.hypot(d.c.x-px,d.c.z-pz)-d.r; d.m.visible=dd<DLIM; } };
  /* ===== 路面字樣：巴士站「BUS STOP」、路口前「慢 SLOW」、大路口黃格 ===== */
  const RT=(()=>{ const mk=(w,h,fn)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); fn(g,w,h); const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t; };
    const txt=(g,s,x,y,sx,sy,font)=>{ g.save(); g.translate(x,y); g.scale(sx,sy); g.font=font; g.textAlign='center'; g.textBaseline='middle'; g.fillText(s,0,0); g.restore(); };
    const tBus=mk(256,1024,(g,w,h)=>{ g.strokeStyle='#ffd23f'; g.lineWidth=12; g.setLineDash([70,40]); g.strokeRect(8,8,w-16,h-16); g.setLineDash([]); g.fillStyle='#ffd23f';
      txt(g,'STOP',w/2,300,1,2.6,'900 70px Arial'); txt(g,'BUS',w/2,690,1,2.6,'900 80px Arial'); });
    const tSlow=mk(256,768,(g,w,h)=>{ g.fillStyle='rgba(255,255,255,.92)'; txt(g,'慢',w/2,230,1.15,2.1,'900 190px sans-serif'); txt(g,'SLOW',w/2,600,1,2.4,'900 74px Arial'); });
    const tBox=mk(256,256,(g,w,h)=>{ g.strokeStyle='#ffd23f'; g.lineWidth=10; g.strokeRect(6,6,w-12,h-12); g.lineWidth=6; g.save(); g.beginPath(); g.rect(6,6,w-12,h-12); g.clip();
      for(let o=-w;o<w*2;o+=36){ g.beginPath(); g.moveTo(o,0); g.lineTo(o+h,h); g.stroke(); g.beginPath(); g.moveTo(o,h); g.lineTo(o+h,0); g.stroke(); } g.restore(); });
    const B={bus:{t:tBus,p:[],u:[]},slow:{t:tSlow,p:[],u:[]},box:{t:tBox,p:[],u:[]}};
    // 中心 (x,z)，闊 w（橫）、長 l（順住行車方向 fx,fz），字頂向前
    const quad=(b,x,z,w,l,fx,fz,y)=>{ const rx=-fz, rz=fx, hw=w/2, hl=l/2; const P=(a,c)=>[x+rx*a+fx*c,y,z+rz*a+fz*c];
      const q=[P(-hw,-hl),P(hw,-hl),P(hw,hl),P(-hw,-hl),P(hw,hl),P(-hw,hl)]; q.forEach(v=>b.p.push(...v)); b.u.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1); };
    STOPS.forEach(([x,z,nx,nz])=>{ const cx=x-nx*4.4, cz=z-nz*4.4; if(!(cellAt(cx,cz)&1)||ELEV(cx,cz)>0.05) return; quad(B.bus,cx,cz,2.9,11,-nz,nx,0.2); });
    if(false) MAP.crossings.forEach(c=>{ const N=NODES[c.node];   // 「慢」字已按要求刪除 let dx=N[0]-c.p[0], dz=N[1]-c.p[1]; const L=Math.hypot(dx,dz)||1; dx/=L; dz/=L; const hw=c.half-2.6, lo=Math.min(hw*0.5,4.2);
      const cx=c.p[0]-dx*11+dz*lo, cz=c.p[1]-dz*11-dx*lo; if(!(cellAt(cx,cz)&1)||ELEV(cx,cz)>0.05) return; quad(B.slow,cx,cz,2.6,6,dx,dz,0.2); });
    NODES.forEach((N,k)=>{ if(!SIGNAL[k]||DEG[k]<4||ELEV(N[0],N[1])>0.05) return; const e=ADJ[k][0], O=NODES[e[0]]; let fx=O[0]-N[0], fz=O[1]-N[1]; const L=Math.hypot(fx,fz)||1; const sz=NW[k]*1.5; quad(B.box,N[0],N[1],sz,sz,fx/L,fz/L,0.205); });
    Object.values(B).forEach(b=>{ if(!b.p.length) return; const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2));
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:b.t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3})); m.renderOrder=1; m.frustumCulled=false; scene.add(m); });
    return {n:B.bus.p.length/18+B.slow.p.length/18+B.box.p.length/18}; })();
  /* ===== 街燈光圈（夜晚／落雨） ===== */
  const LAMPP=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); const rg=g.createRadialGradient(64,64,2,64,64,64); rg.addColorStop(0,'rgba(255,226,160,.85)'); rg.addColorStop(0.5,'rgba(255,210,140,.35)'); rg.addColorStop(1,'rgba(255,200,120,0)'); g.fillStyle=rg; g.fillRect(0,0,128,128);
    const mat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
    const L=props.lamp.filter(([x,z])=>ELEV(x,z)<0.05); const im=new THREE.InstancedMesh(new THREE.PlaneGeometry(11,11),mat,L.length); const o=new THREE.Object3D();
    L.forEach(([x,z,a],i)=>{ o.position.set(x+Math.sin(a||0)*1.6,0.22,z+Math.cos(a||0)*1.6); o.rotation.set(-Math.PI/2,0,0); o.updateMatrix(); im.setMatrixAt(i,o.matrix); });
    im.renderOrder=2; im.visible=false; scene.add(im); return {im,mat}; })();
  let LV=0, WET=false;
  window.__DF=DFRONT; console.log('精細模式：門面',JSON.stringify(DFRONT.reduce((o,f)=>(o[f.type]=(o[f.type]||0)+1,o),{})),'欄杆',panels,'塊、招牌',nSigns,'個、巴士站',STOPS.length,'個、閃爍招牌',nFlick);
  // 日夜：日間霓虹燈管冇咁光；黃昏開少少；夜晚／落雨全開，加光暈
  return { rail:RAILAPI, stops:STOPS,
    set(T,k){ const lv=T.night?1:k==='dusk'?0.55:0; LV=lv; WET=!!T.wet; SMAT.color.setScalar(lv?1:0.74); GMAT.opacity=lv*(T.wet?0.75:0.9); GMAT.visible=lv>0;
      FS.forEach(m=>m.color.copy(SMAT.color)); FG.forEach(m=>{ m.opacity=GMAT.opacity; m.visible=GMAT.visible; }); RMAT.visible=WET&&lv>0; RMAT.opacity=0.7*lv; LAMPP.im.visible=!!(T.night||T.wet); LAMPP.mat.opacity=T.night?0.7:0.4; },
    tick(t){ dcull(t); if(!LV) return; [0,1].forEach(k=>{ const p=(t*(k?9.3:7.1)+k*3.7)%23, off=p<0.35||(p>4&&p<4.15)||(p>4.4&&p<4.6)||(k&&p>15&&p<16.2);   // 大部分時間著，間中閃兩閃，偶然熄一陣
        FS[k].color.setScalar(off?0.45:1); FG[k].opacity=off?0.05:GMAT.opacity; }); } };
})();

if(!GFX){ const NEON=['酒家','冰室','藥房','金行','茶樓','涼茶','麵家','眼鏡','押','海鮮'];
  const mats=NEON.map((t,k)=>new THREE.MeshBasicMaterial({map:canvasTex(64,192,(g,w,h)=>{ const col=['#ff3d7f','#3dd6ff','#ffd23f','#7dff6a','#ff8c42'][k%5];
    g.fillStyle='#22252b'; rr(g,2,2,60,188,10); g.fill(); g.strokeStyle=col; g.lineWidth=5; rr(g,6,6,52,180,8); g.stroke();
    g.fillStyle=col; g.font='bold 40px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; const ch=[...t]; ch.forEach((c,q)=>g.fillText(c,32,96+(q-(ch.length-1)/2)*50)); },false)}));
  // 同一款招牌合併做一個網格（標準模式都慳繪製次數）
  const base=new THREE.PlaneGeometry(1.6,4.8).toNonIndexed(), per=mats.map(()=>[]), o=new THREE.Object3D();
  signs.forEach(s=>{ const mi=rnd()*mats.length|0; [1,-1].forEach(k=>{ o.position.set(s.x,s.y,s.z); o.rotation.set(0,s.a+k*Math.PI/2,0); o.updateMatrix(); const g=base.clone().applyMatrix4(o.matrix); per[mi].push(g); }); });
  per.forEach((gs,mi)=>{ if(!gs.length) return; const P=[],U=[]; gs.forEach(g=>{ P.push(...g.attributes.position.array); U.push(...g.attributes.uv.array); g.dispose(); });
    const G=new THREE.BufferGeometry(); G.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); G.setAttribute('uv',new THREE.Float32BufferAttribute(U,2)); G.computeBoundingSphere(); const m=new THREE.Mesh(G,mats[mi]); m.matrixAutoUpdate=false; scene.add(m); }); }
const CLOUDMAT=new THREE.MeshBasicMaterial({color:0xffffff});
{ const cm=CLOUDMAT, cg=new THREE.SphereGeometry(1,10,8);
  for(let k=0;k<16;k++){ const g=new THREE.Group(); g.position.set(BX0+rnd()*(BX1-BX0),75+rnd()*30,BZ0+rnd()*(BZ1-BZ0)); scene.add(g);
    for(let q=0;q<4;q++){ const m=new THREE.Mesh(cg,cm); m.scale.setScalar(5+rnd()*4); m.position.set(q*6-9,rnd()*2,rnd()*4); g.add(m); } } }

/* ---------- 導航 ---------- */
function nearestNode(x,z){ let best=-1,bd=1e18; for(let i=0;i<NODES.length;i++){ if(!ADJ[i].length) continue; const d=(NODES[i][0]-x)**2+(NODES[i][1]-z)**2; if(d<bd){bd=d;best=i;} } return best; }
function route(from,to,ban){
  const n=NODES.length, dist=new Float64Array(n).fill(Infinity), prev=new Int32Array(n).fill(-1); const open=new Set([from]); dist[from]=0;
  while(open.size){ let u=-1,bd=Infinity; open.forEach(v=>{ if(dist[v]<bd){bd=dist[v];u=v;} }); open.delete(u); if(u===to) break;
    for(const [v,w] of ADJ[u]){ if(ban&&ban.some(e=>e.includes(u)&&e.includes(v))) continue; const nd=dist[u]+w; if(nd<dist[v]){dist[v]=nd;prev[v]=u;open.add(v);} } }
  if(!isFinite(dist[to])) return null; const path=[]; for(let u=to;u!==-1;u=prev[u]) path.push(u); path.reverse(); return {path,len:dist[to]}; }

/* ---------- 紅綠燈：每個路口分兩組方向輪流綠燈 ---------- */
const sigOff=NODES.map((n,k)=>((k*7)%9)*2.4);
const CYCLE=22;
const groupOf=(k,ang)=>Math.abs(Math.cos(ang-REF[k]))>0.707?0:1;
function lightState(k,ang,t){ if(!SIGNAL[k]) return 'g'; const ph=((t+sigOff[k])%CYCLE+CYCLE)%CYCLE;
  if(groupOf(k,ang)===0) return ph<8?'g':ph<10.5?'y':'r'; return ph<11?'r':ph<19?'g':ph<21.5?'y':'r'; }
const SIGS=[];
NODES.forEach((N,k)=>{ if(!SIGNAL[k]) return;
  ADJ[k].forEach(([o,,r])=>{ const O=NODES[o]; const [dx,dz]=dirn(O,N); // 車由 O 駛向 N
    const x=N[0]-dx*(CLR[k]+1.8)+dz*(r.w/2+1.3), z=N[1]-dz*(CLR[k]+1.8)-dx*(r.w/2+1.3);
    if(offRoad(x,z,0.6)) SIGS.push({k,ang:Math.atan2(dx,dz),x,z,fx:-dx,fz:-dz,a:Math.atan2(-dx,-dz)}); }); });
instanced(new THREE.CylinderGeometry(0.13,0.13,4.6,6),M(0x2b2d33),SIGS,(o,s)=>o.position.set(s.x,2.6,s.z),false);
instanced(new THREE.BoxGeometry(1.0,2.6,0.6),M(0x2b2d33),SIGS,(o,s)=>{o.position.set(s.x,5.2,s.z);o.rotation.y=s.a;},true);
const lampGeo=new THREE.SphereGeometry(0.36,12,8);
const LAMP=['r','y','g'].map((c,q)=>{ const m=new THREE.InstancedMesh(lampGeo,new THREE.MeshBasicMaterial({color:0xffffff}),SIGS.length); const o=new THREE.Object3D();
  SIGS.forEach((s,n)=>{ o.position.set(s.x+s.fx*0.3,6.0-q*0.8,s.z+s.fz*0.3); o.updateMatrix(); m.setMatrixAt(n,o.matrix); m.setColorAt(n,new THREE.Color(0x333333)); });
  scene.add(m); return m; });
const LCOL={r:new THREE.Color(0xff2a2a),y:new THREE.Color(0xffc21a),g:new THREE.Color(0x22e06a)}, LOFF=new THREE.Color(0x3a3d44);
function updateLights(t){ SIGS.forEach((s,n)=>{ const st=lightState(s.k,s.ang,t); ['r','y','g'].forEach((c,q)=>LAMP[q].setColorAt(n,st===c?LCOL[c]:LOFF)); }); LAMP.forEach(m=>m.instanceColor.needsUpdate=true); }

/* ---------- 輕鐵路線：屯門鄉事會路、元朗大馬路、天秀路 ---------- */
function tramLine(start){ const seq=[start]; let cur=start, prev=-1;
  for(;;){ const nx=ADJ[cur].find(([o,,r])=>r.t==='avenue'&&o!==prev); if(!nx) break; prev=cur; cur=nx[0]; seq.push(cur); }
  const pts=seq.map(k=>NODES[k]); const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  return {seq,pts,cum,len:cum[cum.length-1]}; }
const TRAM=REGION==='tm'?tramLine(LAY.J.N0):null, TRAM2=REGION==='tm'?tramLine(LAY.J.YW):null, TRAM3=REGION==='tm'?tramLine(LAY.J.TS0):null, TRAMS=REGION==='tm'?[TRAM,TRAM2,TRAM3]:[];   // 沙田冇輕鐵
function tramAt(s,T=TRAM){ s=Math.max(0,Math.min(T.len-0.01,s)); let i=1; while(i<T.cum.length-1&&T.cum[i]<s) i++;
  const A=T.pts[i-1],B=T.pts[i], k=(s-T.cum[i-1])/(T.cum[i]-T.cum[i-1]||1); return {x:A[0]+(B[0]-A[0])*k,z:A[1]+(B[1]-A[1])*k,a:Math.atan2(B[0]-A[0],B[1]-A[1]),i}; }
// 輕鐵站：揀一段直路中間，離所有路口（連斑馬線）至少 22+路口半徑+8 米，唔會阻住橫過嘅馬路
function lrtStop(T){ let best=T.len/2,bs=-1e9; for(let s=24;s<T.len-24;s+=2){ let m=1e9;
    T.seq.forEach((k,i)=>{ if(DEG[k]>=3) m=Math.min(m,Math.abs(T.cum[i]-s)-CLR[k]-8); });
    const a0=tramAt(s-20,T).a, a1=tramAt(s+20,T).a; const bend=Math.abs(Math.sin(a1-a0));
    const score=m-bend*80-Math.abs(s-T.len*0.45)*0.05; if(m>=22&&score>bs){ bs=score; best=s; } } return best; }
if(REGION==='tm'){ TRAM.lrt=LMK.lrt=lrtStop(TRAM); TRAM2.lrt=lrtStop(TRAM2); TRAM3.lrt=lrtStop(TRAM3);
[[TRAM,'輕鐵 屯門站'],[TRAM2,'輕鐵 元朗站'],[TRAM3,'輕鐵 天水圍站']].forEach(([T,nm])=>{ const p=tramAt(T.lrt,T); const g=new THREE.Group(); g.position.set(p.x,0,p.z); g.rotation.y=p.a; scene.add(g);
  add(new THREE.BoxGeometry(3.2,0.9,40),M(0xd5d9de),g,0,0.6,0,false); add(new THREE.BoxGeometry(3.6,0.3,40),M(0xf2a65a),g,0,4.2,0,true);
  [-18,0,18].forEach(o=>add(new THREE.BoxGeometry(0.3,3.4,0.3),M(0x9aa1aa),g,0,2.5,o,false));
  labelPlane(nm,0,4.9,0,Math.PI/2,'#f08c2e',9,g); labelPlane(nm,0,4.9,0,-Math.PI/2,'#f08c2e',9,g);
  for(let s=-20;s<=20;s+=2){ const q=tramAt(T.lrt+s,T); markSeg([q.x,q.z],[q.x,q.z],3.2,2); } });
}
// 架空電線柱
TRAMS.forEach(T=>{ for(let s=8;s<T.len-8;s+=14){ const p=tramAt(s,T); let near=false; T.seq.forEach(k=>{ if(SIGNAL[k]&&Math.hypot(NODES[k][0]-p.x,NODES[k][1]-p.z)<CLR[k]+6) near=true; }); if(near||Math.abs(s-T.lrt)<24) continue;
  const m=add(new THREE.BoxGeometry(0.3,6.5,0.3),M(0x9aa1aa),scene,p.x,3.3,p.z,false); const arm=add(new THREE.BoxGeometry(9,0.15,0.15),M(0x9aa1aa),scene,p.x,6.4,p.z,false); arm.rotation.y=p.a; } });

/* ================= 遊戲玩法 ================= */
const hemi=new THREE.HemisphereLight(0xf4f8ff,0xa8b898,0.62); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff6e8,0.62); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.radius=3;
Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,far:200}); scene.add(sun,sun.target);

const amb=ambulance(); amb.userData.body.scale.setScalar(0.85);
const crew=stretcherSet(); const patient=lyingPatient();
const KIT=(()=>{ const g=new THREE.Group(); scene.add(g); g.visible=false;   // 現場急救袋＋AED
  add(rbox(0.75,0.4,0.45,0.08),M(0xff6a1a),g,0,0.22,0); add(rbox(0.6,0.06,0.3,0.03),M(0xffffff),g,0,0.44,0,false); add(new THREE.BoxGeometry(0.62,0.05,0.06),M(0x22262c),g,0,0.47,0,false);
  add(rbox(0.38,0.3,0.14,0.05),M(0xffd400),g,0.62,0.17,0.05); add(new THREE.BoxGeometry(0.2,0.12,0.02),M(0x23a44a),g,0.62,0.2,0.13,false); return g; })();
const bystander=person('bystander'); scene.add(bystander);

/* ---------- 個案 ---------- */
const CASES=[
 {id:'plaza',place:'屯門市廣場',poi:'plaza',title:'男子暈倒',call:'屯門市廣場外，一名男子突然暈倒，旁人致電 999。',
  steps:['救護員評估清醒程度、呼吸同脈搏','量血壓、檢查血糖','用車床將病人送上救護車'],
  quiz:[{q:'見到有人暈倒，第一步應該點做？',o:['確認環境安全，拍膊頭大聲叫佢，睇吓有冇反應','即刻餵佢飲水','搖醒佢，扶佢企起身'],why:'先確保自己安全，再檢查反應同呼吸。冇反應就即刻打 999。'},
        {q:'病人有呼吸但冇反應，等救護車期間應該點擺？',o:['擺復原臥式（側臥）','扶佢坐起身','俾佢俯伏瞓'],why:'側臥可以保持氣道暢通，防止嘔吐物阻塞。'}],
  equip:{q:'男子暈倒但有呼吸，救護員要檢查血糖，用什麼裝備？',o:['🩸 血糖機','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'暈倒可能係低血糖引起，用血糖機一驗就知，可以即刻處理。'},
  tips:['見到有人暈倒，即刻打 999','講清楚地點、病人狀況同聯絡電話','病人有呼吸就擺側臥，保持氣道暢通']},
 {id:'park',place:'屯門公園',poi:'park',title:'長者跌倒',call:'屯門公園內，一位婆婆跌倒，話腳好痛企唔起身。',
  steps:['救護員檢查受傷位置同感覺','用夾板固定懷疑骨折嘅腳','小心抬婆婆上車床'],
  quiz:[{q:'婆婆跌倒後話腳好痛、企唔起身，應該點做？',o:['唔好郁佢，陪住佢等救護員','即刻扶佢企起身試吓行','用力搓痛嘅位置'],why:'可能有骨折，亂郁會令傷勢加重。保持佢舒服、保暖，等救護員處理。'},
        {q:'救護員用夾板固定懷疑骨折嘅腳，係為咗？',o:['減少郁動，減輕痛楚同避免傷勢加重','令骨頭即刻癒合','代替止痛藥'],why:'固定傷處可以減少移動時嘅痛楚，避免進一步受傷。'}],
  equip:{q:'婆婆懷疑腳骨折，救護員應該用咩裝備？',o:['🦴 真空夾板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'用夾板固定懷疑骨折嘅位置，搬動時會少啲痛，亦避免傷勢加重。'},
  tips:['長者跌倒後唔好急住扶佢企起身','懷疑骨折就唔好隨便移動傷處','陪住長者，等救護員到場']},
 {id:'townhall',place:'屯門大會堂',poi:'townhall',title:'女士胸口痛',call:'屯門大會堂，一位女士胸口翳痛、出冷汗。',
  steps:['救護員問病歷：幾時開始痛、痛去邊','俾氧氣、做心電圖','安排病人半坐臥送院'],
  quiz:[{q:'女士胸口翳痛、出冷汗，最需要擔心係咩？',o:['可能係心臟病發','可能只係肚餓','可能係扭傷'],why:'胸口翳痛加出冷汗係心臟病發嘅警號，要盡快召救護車。'},
        {q:'等救護車期間，應該點樣幫佢？',o:['讓佢坐低或半坐臥休息，唔好走動','叫佢自己行去醫院','叫佢做運動舒緩下'],why:'休息可以減少心臟負擔。如果佢暈低冇反應，就要做心肺復甦。'}],
  equip:{q:'女士胸口痛，救護員要即刻檢查心臟，應該用咩裝備？',o:['💓 DM機（心電圖功能）','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'心電圖可以睇到心臟有冇出問題，資料仲可以預先通知醫院。'},
  tips:['胸口痛、出冷汗可能係心臟病發，即刻打 999','等候時讓病人坐低休息，唔好走動','如果病人暈低冇反應，盡快做心肺復甦']},
 {id:'station',place:'屯門站',poi:'station',title:'少年哮喘發作',call:'屯門站外，一名少年哮喘發作，透唔到氣。',
  steps:['救護員評估呼吸同血含氧量','用霧化器俾藥舒緩氣管','讓病人坐直送院'],
  quiz:[{q:'有人哮喘發作、透唔到氣，等救護車期間應該點做？',o:['讓佢坐直身，協助佢用自己嘅氣管舒張劑（如有）','叫佢平躺瞓低','叫佢跑兩步深呼吸'],why:'坐直有助呼吸；如果佢有醫生處方嘅噴劑，可以協助佢使用。'}],
  equip:{q:'少年哮喘發作，救護員應該用咩裝備幫佢舒緩氣管？',o:['💨 霧化器','🦴 夾板','🩸 血糖機','🩹 燒傷敷料'],why:'霧化器可以將舒緩氣管嘅藥物變成霧氣吸入，令呼吸暢順啲。'},
  tips:['哮喘發作要保持冷靜，讓病人坐直','協助病人使用自己嘅噴劑','情況冇改善或者講唔到嘢，即刻打 999']},
 {id:'market',place:'屯門街市',poi:'market',title:'檔主燙傷',call:'屯門街市，一位檔主俾滾水燙傷手臂。',
  steps:['救護員檢查燒傷範圍同深度','用清水降溫，再用燒傷敷料包紮','安撫病人，送院'],
  quiz:[{q:'俾滾水燙傷，第一時間應該點處理？',o:['用清涼嘅流動水沖洗傷處 10 至 20 分鐘','塗牙膏或者豉油','用冰塊直接敷'],why:'清涼流動水可以降溫止痛；唔好用冰或者偏方，會令傷勢更差。'}],
  equip:{q:'檔主手臂燙傷，救護員降溫之後應該用咩包紮？',o:['🩹 燒傷敷料','🦴 夾板','💓 DM機（心電圖功能）','💨 霧化器'],why:'燒傷敷料可以保護傷口、減少感染同痛楚。'},
  tips:['燙傷即刻用清涼流動水沖 10 至 20 分鐘','除去傷處附近嘅首飾，但唔好撕黐住嘅衫','唔好塗牙膏、豉油或者用冰']},
 {id:'crash',place:'青山公路',poi:'crash',title:'巴士小巴相撞',call:'青山公路一架雙層巴士同一架綠色小巴相撞，有乘客受傷，話頸痛。',
  steps:['救護員確保現場安全，評估傷者清醒程度','用頸套同脊椎板固定頸椎','小心將傷者抬上車床'],
  quiz:[{q:'你目擊交通意外，第一步應該點做？',o:['留意自身安全，喺安全位置打 999，唔好隨便移動傷者','即刻將傷者拉出車外','企喺馬路中間影相'],why:'先保障自己同其他人嘅安全；除非有即時危險（例如起火），唔好移動傷者，以免加重頸椎或脊椎受傷。'}],
  equip:{q:'傷者撞車後頸痛，懷疑頸椎受傷，救護員應該用咩裝備？',o:['🦺 頸套同長脊椎板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'頸套同脊椎板可以固定頸椎同脊椎，搬動時減少進一步受傷。'},
  tips:['發生交通意外，先留意自身安全，再打 999','除非有即時危險，唔好移動傷者','講清楚意外地點、涉及車輛同傷者數目']},
 {id:'yltrauma',place:'元朗劇院',poi:'yltheatre',title:'工人高處墮下',call:'元朗劇院外牆翻新，一名男工人由約 9 米高嘅棚架墮下。GCS 14、血壓 118/76、呼吸每分鐘 20。最就近係博愛醫院。',
  steps:['救護員評估氣道、呼吸、清醒程度同生命表徵','用頸套同脊椎板固定','按創傷分流準則決定送邊間醫院'],
  quiz:[{q:'以下邊個情況，符合「創傷分流」要送去創傷中心？',o:['成人由 6 米（20 呎）以上高處墮下','成人由 1 米高樓梯跌落，手腕擦傷','GCS 15、血壓正常、冇特別致傷過程'],why:'資料庫創傷分流準則：成人（≥12 歲）由 6 米以上高處墮下，要送創傷中心；其他準則包括 GCS 3–13、收縮壓 <90、呼吸 <10 或 ≥30 等。'}],
  equip:{q:'工人由高處墮下，懷疑脊椎受傷，救護員應該用咩裝備？',o:['🦺 頸套同脊椎板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'高處墮下有機會傷及頸椎同脊椎，要先固定再搬動。'},
  triage:{q:'工人由約 9 米墮下，最就近係博愛醫院（非創傷中心）。應該送邊間？',o:['🏥 屯門醫院（創傷中心）','🏥 博愛醫院（最就近）'],dest:['tmh','poh'],why:'成人由 6 米以上墮下符合創傷分流準則，要送創傷中心；新界西嘅創傷中心係屯門醫院。例外：病人心臟驟停，或者用 BVM 後仍未能有效處理氣道／呼吸，就要送最就近醫院。'},
  tips:['見到有人由高處墮下，唔好隨便郁佢，即刻打 999','講清楚墮下高度同傷者情況','留意自身安全，遠離仍有危險嘅位置']},
 {id:'ylstroke',place:'元朗公園',poi:'ylpark',title:'伯伯懷疑中風',call:'元朗公園，一位 72 歲伯伯 40 分鐘前突然右邊手腳無力、講嘢唔清。血壓 168/92、GCS 15。屬區醫院係博愛醫院。',
  steps:['救護員驗血糖，排除血糖過低','做 FAST-ED 評分','預先通報醫院，按中風分流送院'],
  quiz:[{q:'伯伯單側嘴角下垂（1 分）、一邊手完全抬唔起（2 分）、只講到 1 樣動物（1 分），其餘正常。FAST-ED 總分係？',o:['4 分','2 分','9 分'],why:'F 1 分＋A 2 分＋S 1 分＝4 分。適用：突發單邊無力或語言障礙、4 小時內、18 歲或以上、SBP > 100、GCS ≥ 8，並已排除血糖過低（H\'stix > 4.0）。'}],
  equip:{q:'進行中風評估之前，救護員一定要先排除咩問題？揀啱裝備：',o:['🩸 血糖機','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'血糖過低可以引起類似中風嘅症狀，要先驗血糖（H\'stix > 4.0 mmol/L）先做中風評估。'},
  triage:{q:'FAST-ED 4 分，病發 40 分鐘，屬區係博愛醫院。應該點樣送院？',o:['🏥 通報後分流去屯門醫院','🏥 送屬區博愛醫院'],dest:['tmh','poh'],why:'院前中風通報及分流：博愛醫院屬區嘅病人 FAST-ED ≥ 4 分，分流至屯門醫院，並要預先通報醫院，方便盡快做溶栓治療。'},
  tips:['記住 FAST：面、手、講嘢、時間','發現懷疑中風，記低病發或者最後正常嘅時間，即刻打 999','唔好俾病人飲嘢食嘢，以免哽親']},
 {id:'ylarrest',place:'元朗站',poi:'ylstation',title:'墮下後心臟驟停',call:'元朗站外，一名男子由約 8 米高嘅行人天橋墮下。救護員到場時佢冇反應、冇正常呼吸，心臟驟停。最就近係博愛醫院。',
  steps:['救護員確認心臟驟停，即刻做心肺復甦','貼上自動心臟除顫器電極片，分析心律','繼續心肺復甦，盡快送院'],
  quiz:[{q:'為成人做心肺復甦，胸外按壓應該點做？',o:['每分鐘 100 至 120 下，按深 5 至 6 厘米','每分鐘 60 下，按深 2 厘米就夠','每分鐘 150 下，按完唔使等胸口回彈'],why:'用力、快速按壓胸口中央：每分鐘 100 至 120 下、深 5 至 6 厘米，每次按完讓胸口完全回彈，盡量減少中斷。'}],
  equip:{q:'傷者心臟驟停，救護員最需要即刻用咩裝備？',o:['⚡ 自動心臟除顫器（AED）','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'心臟驟停要盡快做心肺復甦同使用除顫器，越早除顫，存活機會越高。'},
  triage:{q:'傷者由 8 米墮下，本身符合創傷分流準則，但已經心臟驟停。應該送邊間？',o:['🏥 博愛醫院（最就近）','🏥 屯門醫院（創傷中心）'],dest:['poh','tmh'],why:'創傷分流第一步：病人心臟驟停，就要送最就近醫院，唔再按其他準則分流去創傷中心。另一個例外係用 BVM 後仍然未能有效處理氣道或呼吸。'},
  tips:['見到有人冇反應、冇正常呼吸，即刻打 999 並開始心肺復甦','附近有自動心臟除顫器就盡快攞嚟用，跟住機器語音指示','用力、快速按壓胸口中央，每分鐘 100 至 120 下']},
 {id:'tswtrauma',place:'天水圍站',poi:'tswstation',title:'單車手被撞',call:'天水圍站外天瑞路，一名男單車手俾私家車撞倒。佢醒，GCS 14，但面色蒼白、手腳凍，血壓 84/52、脈搏每分鐘 124。最就近係天水圍醫院。',
  steps:['救護員評估氣道、呼吸、循環同清醒程度','止血、保暖，用頸套同脊椎板固定','按創傷分流準則決定送邊間醫院'],
  quiz:[{q:'創傷病人以下邊個生命表徵，符合「創傷分流」要送創傷中心？',o:['收縮壓低過 90 mmHg','收縮壓 128 mmHg、呼吸每分鐘 18','脈搏每分鐘 88'],why:'資料庫創傷分流準則：≥12 歲病人收縮壓 < 90 mmHg（或者毛細管回流多過 2 秒）要送創傷中心；其他準則包括 GCS 3–13、呼吸 < 10 或 ≥ 30、成人由 6 米以上墮下等。'}],
  equip:{q:'單車手俾車撞倒，懷疑頸椎受傷，救護員應該用咩裝備？',o:['🦺 頸套同脊椎板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'撞車有機會傷及頸椎同脊椎，要先固定再搬動。'},
  triage:{q:'單車手血壓 84/52，最就近係天水圍醫院（非創傷中心）。應該送邊間？',o:['🏥 屯門醫院（創傷中心）','🏥 天水圍醫院（最就近）'],dest:['tmh','tsh'],why:'收縮壓 < 90 mmHg 符合創傷分流準則，要送創傷中心；新界西嘅創傷中心係屯門醫院。例外：病人心臟驟停，或者用 BVM 後仍未能有效處理氣道／呼吸，就送最就近醫院。'},
  tips:['見到交通意外，先留意自身安全，喺安全位置打 999','唔好隨便移動傷者，除非有即時危險','用乾淨布料按住流血位置，替傷者保暖']},
 {id:'tswstroke',place:'香港濕地公園',poi:'tswwet',title:'遊客懷疑中風',call:'香港濕地公園，一位 66 歲女士 1 個鐘前突然左邊手腳無力、講嘢含糊。血壓 172/96、GCS 15、H\'stix 6.8。屬區醫院係天水圍醫院。',
  steps:['救護員驗血糖，排除血糖過低','做 FAST-ED 評分','預先通報醫院，按中風分流送院'],
  quiz:[{q:'以下邊個情況，唔符合「院前中風通報」條件？',o:['病發或最後正常時間已經超過 4 小時','18 歲或以上','收縮壓 > 100 mmHg 同 GCS ≥ 8'],why:'院前中風通報要病發或最後正常時間喺 4 小時內，18 歲或以上、唔係長期臥床或輪椅使用者、SBP > 100 mmHg 及 GCS ≥ 8，並已排除血糖過低（H\'stix > 4.0）。'}],
  equip:{q:'女士突然一邊手腳無力，做中風評估之前要先排除咩？揀啱裝備：',o:['🩸 血糖機','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'血糖過低可以引起類似中風嘅症狀，要先驗血糖（H\'stix > 4.0 mmol/L）先做中風評估。'},
  triage:{q:'FAST-ED 5 分，病發 1 個鐘，屬區係天水圍醫院。應該點樣送院？',o:['🏥 通報後分流去屯門醫院','🏥 送屬區天水圍醫院'],dest:['tmh','tsh'],why:'院前中風通報及分流：天水圍醫院屬區嘅病人 FAST-ED ≥ 4 分，分流至屯門醫院，並要預先通報，方便盡快做溶栓治療。'},
  tips:['記住 FAST：面、手、講嘢、時間','記低病發或者最後正常嘅時間，即刻打 999','唔好俾病人飲嘢食嘢，以免哽親']},
 {id:'tswarrest',place:'屏山聚星樓',poi:'jusing',title:'伯伯心臟驟停',call:'屏山聚星樓外，一位 70 歲伯伯行行下突然暈低。救護員到場時佢冇反應、冇正常呼吸，途人已經開始做心肺復甦。最就近係天水圍醫院。',
  steps:['救護員確認心臟驟停，接手做心肺復甦','貼上除顫器電極片，分析心律，需要時電擊','繼續心肺復甦，盡快送最就近醫院'],
  quiz:[{q:'自動心臟除顫器（AED）分析完講「建議電擊」，應該點做？',o:['大聲叫所有人唔好掂病人，確認冇人掂先按電擊鍵','一邊按住胸口一邊按電擊鍵','唔使理，繼續按壓就得'],why:'電擊前一定要確保冇人接觸病人，電擊後即刻繼續胸外按壓，跟住 AED 語音指示。'}],
  equip:{q:'伯伯心臟驟停，救護員最需要即刻用咩裝備？',o:['⚡ 自動心臟除顫器（AED）','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'心臟驟停要盡快做心肺復甦同使用除顫器，越早除顫，存活機會越高。'},
  triage:{q:'伯伯心臟驟停，持續心肺復甦中。應該送邊間？',o:['🏥 天水圍醫院（最就近）','🏥 屯門醫院（較遠）'],dest:['tsh','tmh'],why:'心臟驟停病人要以最快時間送到醫院，所以送最就近醫院，途中持續做高質素心肺復甦。'},
  tips:['見到有人冇反應、冇正常呼吸，即刻打 999 並開始心肺復甦','附近有 AED 就盡快攞嚟用，跟住語音指示','用力、快速按壓胸口中央，每分鐘 100 至 120 下']},
 {id:'mass',place:'屯門市廣場',poi:'plaza',title:'大量傷者事故',call:'屯門市廣場有扶手電梯意外，多人受傷！控制中心已派出多架救護車一齊前往。',
  steps:['救護員為傷者分流，貼上紅、黃、綠分流卡','先處理同運送傷勢最重（紅卡）嘅傷者','其他救護車接載餘下傷者'],
  quiz:[{q:'大量傷者事故，救護員到場後最先做咩？',o:['傷者分流：按傷勢輕重排先後','邊個叫得最大聲就先救邊個','將所有傷者送去同一間醫院'],why:'分流可以喺資源有限時，令傷勢最危急嘅傷者最快得到治療，傷者亦會分送唔同醫院。'}],
  equip:{q:'大量傷者現場，救護員用咩幫傷者分類？',o:['🏷️ 分流卡（紅黃綠標籤）','🦴 夾板','💨 霧化器','🩸 血糖機'],why:'分流卡用顏色標示傷勢緩急：紅色最危急、黃色次之、綠色傷勢較輕，方便其他救護人員一眼睇到。'},
  tips:['大量傷者現場要聽從救護員同警察指示','傷勢較輕又行到嘅人，可以按指示去指定位置等候','唔好圍觀，讓出通道俾救護車']}
];
/* ---------- 關卡 ---------- */
const LEVELS_TM=[
 {id:'L1',caseId:'plaza',  tod:'day',  todName:'日間',      cars:16,works:0,jam:0,dash:0,limit:1.9},
 {id:'L2',caseId:'park',   tod:'day',  todName:'日間',      cars:22,works:1,jam:0,dash:1,limit:1.8},
 {id:'L3',caseId:'townhall',tod:'dusk',todName:'黃昏',      cars:26,works:1,jam:1,dash:1,limit:1.7},
 {id:'L4',caseId:'station',tod:'night',todName:'夜晚',      cars:22,works:1,jam:1,dash:2,limit:1.7},
 {id:'L5',caseId:'market', tod:'rain', todName:'夜晚落雨',  cars:24,works:2,jam:1,dash:2,limit:1.8},
 {id:'L6',caseId:'crash',  tod:'day',  todName:'日間',      cars:24,works:0,jam:1,dash:1,limit:1.7,support:['police','fire']},
 {id:'L7',caseId:'mass',   tod:'dusk', todName:'黃昏',      cars:22,works:1,jam:0,dash:1,limit:1.7,escort:4},
 {id:'L8',caseId:'yltrauma',tod:'day', todName:'日間・元朗',  cars:22,works:0,jam:0,dash:1,limit:2.0,depot:'yl',support:['moto','fire']},
 {id:'L9',caseId:'ylstroke',tod:'night',todName:'夜晚・元朗',  cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'yl'},
 {id:'L10',caseId:'ylarrest',tod:'dusk',todName:'黃昏・元朗',  cars:20,works:0,jam:0,dash:1,limit:2.0,depot:'yl',support:['moto']},
 {id:'L11',caseId:'tswtrauma',tod:'day',todName:'日間・天水圍',cars:22,works:0,jam:1,dash:1,limit:2.0,depot:'tsw',support:['police']},
 {id:'L12',caseId:'tswstroke',tod:'dusk',todName:'黃昏・天水圍',cars:20,works:1,jam:0,dash:1,limit:2.0,depot:'tsw'},
 {id:'L13',caseId:'tswarrest',tod:'night',todName:'夜晚・天水圍',cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'yl',support:['moto']}];
/* ---------- 救護任務（沙田）：6 關 ---------- */
CASES.push(
 {id:'sttrauma',place:'沙田公園單車徑',poi:'stpark',title:'單車相撞',call:'沙田公園城門河單車徑，兩架單車相撞，一名男子跌落地。佢醒，但講嘢斷斷續續，呼吸每分鐘 34 次、急速，血壓 118/76。',
  steps:['救護員評估氣道、呼吸、循環同清醒程度','固定頸椎，處理傷口，給予氧氣','按創傷分流準則決定送院，並預先通報'],
  quiz:[{q:'以下邊個生命表徵，符合「創傷分流」準則？',o:['呼吸每分鐘 ≥ 30 次','血壓 118/76','脈搏每分鐘 88'],why:'資料庫創傷分流準則：呼吸每分鐘 < 10 或 ≥ 30、收縮壓 < 90 mmHg、GCS 3–13、成人由 6 米以上墮下等，都要送創傷中心。'}],
  equip:{q:'單車相撞、跌落地，懷疑頸椎受傷，救護員應該用咩裝備？',o:['🦺 頸套同脊椎板','🩸 血糖機','💨 Ventolin 噴劑','📈 12 導程心電圖'],why:'撞車同跌倒有機會傷及頸椎同脊椎，要先固定再搬動。'},
  triage:{q:'傷者呼吸每分鐘 34 次，符合創傷分流準則。應該送邊間？',o:['🏥 威爾斯親王醫院（創傷中心，預先通報）','🏥 沙田醫院'],dest:['pwh','pwh'],why:'威爾斯親王醫院本身係新界東嘅創傷中心，沙田區傷者直接送去，並預先通報醫院準備。沙田醫院唔提供急症室服務，唔可以送去。'},
  tips:['喺單車徑見到意外，先留意自身安全，提醒其他單車停低','唔好隨便移動傷者，即刻打 999','用乾淨布料按住流血位置']},
 {id:'ststroke',place:'車公廟',poi:'stck',title:'婆婆懷疑中風',call:'車公廟，一位 72 歲婆婆 1 個鐘前突然右邊手腳無力、口角歪斜。血壓 168/92、GCS 15、H\'stix 7.2。屬區醫院係威爾斯親王醫院。',
  steps:['救護員驗血糖，排除血糖過低','做 FAST-ED 評分','按屬區通報，送院'],
  quiz:[{q:'院前中風通報要符合咩時間條件？',o:['病發或最後正常時間喺 4 小時內','病發喺 24 小時內','冇時間限制'],why:'院前中風通報要病發或最後正常時間喺 4 小時內，18 歲或以上、SBP > 100 mmHg 及 GCS ≥ 8，並已排除血糖過低。'}],
  equip:{q:'婆婆突然一邊手腳無力，做中風評估之前要先排除咩？揀啱裝備：',o:['🩸 血糖機','🦺 頸套同脊椎板','💨 Ventolin 噴劑','📈 12 導程心電圖'],why:'血糖過低可以引起類似中風嘅症狀，要先驗血糖（H\'stix > 4.0 mmol/L）。'},
  triage:{q:'FAST-ED 5 分，病發 1 個鐘，屬區係威爾斯親王醫院。應該點樣送院？',o:['🏥 按屬區通報，直接送威爾斯親王醫院','🏥 分流去那打素醫院'],dest:['pwh','pwh'],why:'資料庫：如原本之屬區醫院為 PWH 或 TMH，不屬於分流，按屬區通報送院。反而係那打素醫院、北區醫院屬區嘅病人 FAST-ED ≥ 4 分，先要分流到威爾斯親王醫院。'},
  tips:['記住 FAST：面、手、講嘢、時間','記低病發或者最後正常嘅時間','唔好俾病人飲嘢食嘢']},
 {id:'starrest',place:'新城市廣場',poi:'stntp',title:'商場有人暈低',call:'新城市廣場，一位 55 歲男子行街時突然暈低，冇反應、冇正常呼吸。保安已經開始做心肺復甦，同埋攞咗商場嘅 AED。',
  steps:['救護員確認心臟驟停，接手做心肺復甦','用除顫器分析心律，需要時電擊','繼續心肺復甦，盡快送最就近醫院'],
  quiz:[{q:'救護員到場，AED 已經貼咗電極片。分析心律期間應該點？',o:['停止按壓，所有人唔好接觸病人','繼續按壓，唔使理','郁動病人方便上擔架'],why:'分析心律期間任何接觸或者郁動都會影響分析，要停手、唔好接觸病人，跟住 AED 語音指示。'}],
  equip:{q:'男子心臟驟停，救護員最需要即刻用咩裝備？',o:['⚡ 自動心臟除顫器（AED）','🩸 血糖機','💨 Ventolin 噴劑','🦺 頸套同脊椎板'],why:'心臟驟停要盡快做心肺復甦同電擊，越早除顫存活機會越高。'},
  triage:{q:'男子心臟驟停，持續心肺復甦中。應該送邊間？',o:['🏥 威爾斯親王醫院（最就近急症室）','🏥 沙田醫院'],dest:['pwh','pwh'],why:'心臟驟停要以最快時間送到最就近有急症室嘅醫院，即係威爾斯親王醫院，途中持續做高質素心肺復甦。'},
  tips:['見到有人冇反應、冇正常呼吸，即刻打 999 同開始 CPR','商場通常有 AED，叫人攞嚟','用力、快速按壓胸口中央']},
 {id:'sthypo',place:'沙田第一城',poi:'stcity',title:'糖尿伯伯神志不清',call:'沙田第一城，一位 68 歲伯伯有糖尿病，早上打完胰島素冇食早餐，而家冒冷汗、手震、講嘢含糊。佢仲識吞嚥。',
  steps:['救護員評估清醒程度，驗血糖：H\'stix 2.8 mmol/L','問 MIAMIA：食嘢、胰島素、活動、藥物、病、酒','按 Glycemia protocol 處理'],
  quiz:[{q:'伯伯第一次 H\'stix 2.8 mmol/L，清醒、識吞嚥。按資料庫應該點處理？',o:['口服 D10W 糖水 200 ml','即刻打 IV 鹽水','唔使處理，送院先算'],why:'Glycemia：第一次 H\'stix ≦ 4 而病人識吞嚥，可以口服 D10W 每次 200 ml（口服唔需要 Thiamine），之後再驗血糖。'}],
  equip:{q:'糖尿病人冒冷汗、手震、講嘢含糊，救護員要即刻用咩裝備？',o:['🩸 血糖機','📈 12 導程心電圖','💨 Ventolin 噴劑','🦺 頸套同脊椎板'],why:'清醒程度下降或神經功能急性變化，要即刻驗血糖，≦ 4 mmol/L 或 > 20 mmol/L 就要按 Glycemia protocol 處理。'},
  tips:['糖尿病人冒冷汗、手震、神志不清，可能係血糖過低','如果病人清醒、識吞嚥，可以俾佢食啲糖','神志唔清嘅病人唔好餵嘢食，以免哽親']},
 {id:'stasthma',place:'沙田馬場',poi:'strace',title:'哮喘發作',call:'沙田馬場，一位 30 歲女士有哮喘病歷，睇馬期間突然氣促、有喘鳴聲，講嘢一句斷一句，SpO2 92%。佢冇帶自己嘅噴劑。',
  steps:['救護員檢查 SpO2，給予氧氣','聽肺，量維生指數','確認適用症、排除禁忌症，給予 Ventolin'],
  quiz:[{q:'女士 30 歲，按 Respiratory protocol，Ventolin 每次劑量係幾多？',o:['400 mcg（4 下）','200 mcg（2 下）','300 mcg（3 下）'],why:'Salbutamol（Ventolin）：12 歲或以上 400 mcg（4 puffs）；5 至 < 12 歲 300 mcg；2 至 < 5 歲 200 mcg。仍然氣促，相隔 5 分鐘可以再俾下一劑。'}],
  equip:{q:'哮喘病人氣促、有喘鳴聲，救護員應該用咩藥物裝備？',o:['💨 Ventolin 噴劑（配儲霧器）','🩸 血糖機','📈 12 導程心電圖','🦺 頸套同脊椎板'],why:'主要不適為氣促，而病人有哮喘病歷，符合 Ventolin 適用症（要先排除對 Ventolin 敏感）。'},
  tips:['哮喘病人應該隨身帶備自己嘅噴劑','幫病人坐直身，保持冷靜','如果氣促加劇、嘴唇發紫，即刻打 999']},
 {id:'stcardiac',place:'萬佛寺',poi:'stbuddha',title:'行山後胸口痛',call:'萬佛寺山腳，一位 58 歲男士行完樓梯後胸口好似俾大石壓住，痛到左手，冒冷汗，已經 20 分鐘。血壓 146/88、脈搏 96、GCS 15。冇藥物過敏。',
  steps:['救護員問 OPQRST，評估懷疑心源性胸痛','排除禁忌症，給予 ASA','做 12 導程心電圖，盡快送院'],
  quiz:[{q:'以下邊個情況，唔可以俾病人服用 ASA（阿士匹靈）？',o:['病人對 ASA 或 NSAIDs 過敏','病人 58 歲','血壓 146/88'],why:'ASA 禁忌症（SAPHBUS）：唔識吞嚥、< 12 歲、懷孕、對 ASA 或 NSAIDs 過敏、不能控制嘅出血、24 小時內已因今次不適服用、一星期內做過手術；裝有 LVAD 亦唔可以。劑量係 200 mg，只俾一次。'}],
  equip:{q:'懷疑心源性胸痛，救護員應該用咩裝備評估心臟？',o:['📈 12 導程心電圖','🩸 血糖機','💨 Ventolin 噴劑','🦺 頸套同脊椎板'],why:'12 歲或以上有心源性胸痛或不適，可以做 12-Lead ECG；如情況許可，盡量喺給予相應治療後喺現場做。'},
  tips:['胸口好似俾大石壓住、痛到手臂或下巴，可能係心臟病','即刻停低休息，打 999','唔好自己揸車去醫院']},
 {id:'stbleed',place:'沙田運動場',poi:'stsport',title:'跑步跌倒流血',call:'沙田運動場，一名 40 歲男子跑步時跌倒，膝頭同手臂擦傷，前臂有一條深傷口不停流血。佢清醒，有少少頭暈。',
  steps:['救護員戴手套，用敷料直接加壓止血','檢查有冇其他傷勢，量維生指數','包紮固定傷口，送院處理'],
  quiz:[{q:'傷口不停流血，第一時間應該點做？',o:['用乾淨布料直接用力按住傷口','先用水沖走啲血再算','用紙巾抹乾就得'],why:'直接加壓係最有效嘅止血方法。按住唔好放手；血滲出嚟就喺上面再加一層，唔好拎走第一層。'}],
  equip:{q:'前臂傷口流血不止，救護員應該用咩裝備？',o:['🩹 加壓敷料同繃帶','🩸 血糖機','💨 Ventolin 噴劑','📈 12 導程心電圖'],why:'加壓敷料可以直接壓住傷口止血，再用繃帶包紮固定。'},
  tips:['流血時用乾淨布料直接用力按住傷口','血滲出唔好拎走敷料，再加一層繼續按','處理傷口前後要洗手，可以嘅話戴手套']},
 {id:'stallergy',place:'禾輋廣場',poi:'stwoche',title:'食物嚴重過敏',call:'禾輋廣場食肆，一位 25 歲女士食完嘢之後成身出紅疹、口唇同眼腫，聲沙、氣促。佢話自己對花生過敏，手袋入面有腎上腺素自動注射器。',
  steps:['救護員評估氣道同呼吸，給予氧氣','協助使用腎上腺素，量維生指數','密切監察，盡快送院'],
  quiz:[{q:'有人嚴重過敏、氣促，身上有醫生處方嘅腎上腺素自動注射器，應該點做？',o:['協助佢喺大腿外側注射，然後即刻打 999','叫佢飲多啲水沖淡','等症狀自己退咗先算'],why:'嚴重過敏反應可以好快危及生命。病人有醫生處方嘅腎上腺素自動注射器，應該協助佢喺大腿外側使用，並立即召救護車。'}],
  equip:{q:'女士嚴重過敏、聲沙氣促，救護員最需要即刻準備咩藥物？',o:['💉 腎上腺素（Adrenaline）','🩸 血糖機','🦺 頸套同脊椎板','🩹 加壓敷料同繃帶'],why:'嚴重過敏反應嘅首要藥物係腎上腺素，可以紓緩氣道腫脹同血壓下降。'},
  tips:['知道自己有嚴重過敏，要隨身帶備醫生處方嘅腎上腺素注射器','面腫、聲沙、氣促係危險訊號，即刻打 999','用咗腎上腺素注射器都一定要送院觀察']},
 {id:'stseizure',place:'沙田站',poi:'ststn',title:'抽筋後人事不省',call:'沙田站大堂，一名 30 歲男子突然倒地全身抽搐，大約兩分鐘後停止。依家叫佢冇反應，但有呼吸。途人話佢有癲癇病史。',
  steps:['救護員評估氣道同呼吸，檢查有冇撞傷','擺復原臥式，給予氧氣，驗血糖','監察清醒程度，送院'],
  quiz:[{q:'有人抽筋（癲癇發作）期間，旁人應該點做？',o:['移開附近硬物、保護佢個頭，記低抽筋時間','塞嘢入佢口，防止咬脷','用力按住佢手腳，令佢停'],why:'抽筋期間唔好塞任何嘢入口，亦唔好強行按住。移開危險物件、保護頭部、記低時間；停咗之後有呼吸就擺側臥。抽筋超過 5 分鐘要即刻打 999。'}],
  equip:{q:'男子抽筋後冇反應，救護員要即刻排除邊個常見原因？揀啱裝備：',o:['🩸 血糖機','🩹 加壓敷料同繃帶','💨 Ventolin 噴劑','🦺 頸套同脊椎板'],why:'血糖過低都可以引致抽筋同昏迷，救護員要盡快驗血糖。'},
  tips:['抽筋時唔好塞嘢入口，亦唔好強行按住','保護頭部，記低抽筋開始同停止嘅時間','抽筋停咗仍然冇反應，有呼吸就擺側臥']},
 {id:'stbreath',place:'曾大屋',poi:'sttsang',title:'伯伯嚴重氣促',call:'曾大屋附近，一位 75 歲伯伯行完樓梯之後非常氣促，坐低都唔夠氣，嘴唇有啲發紫，講嘢只講到幾個字。佢有慢性肺病。',
  steps:['救護員檢查 SpO2，給予氧氣','聽肺，量維生指數','讓伯伯坐直身，盡快送院'],
  quiz:[{q:'有人嚴重氣促，等救護車期間應該點樣幫佢？',o:['讓佢坐直身或身向前傾，鬆開緊身衣物','叫佢平躺瞓低休息','叫佢行吓透吓氣'],why:'坐直或身向前傾可以幫助呼吸，亦要鬆開衣領、保持空氣流通。嘴唇發紫、講唔到完整句子係危險訊號，要即刻打 999。'}],
  equip:{q:'伯伯嚴重氣促、嘴唇發紫，救護員應該即刻俾咩？',o:['🫁 氧氣','🩸 血糖機','🦺 頸套同脊椎板','🩹 加壓敷料同繃帶'],why:'病人血含氧量低，救護員會用 SpO2 監察，按需要給予氧氣。'},
  tips:['嚴重氣促時坐直或身向前傾','講唔到完整句子、嘴唇發紫，即刻打 999','病人有醫生處方嘅噴劑，可以協助佢使用']},
 {id:'stfever',place:'沙田大會堂',poi:'sttownh',title:'婆婆發燒神志混亂',call:'沙田大會堂，一位 80 歲婆婆發燒咗兩日，今日睇表演期間變得神志混亂、好虛弱，企都企唔穩，摸落身體好熱。',
  steps:['救護員量體溫、血壓、脈搏同 SpO2','評估清醒程度，驗血糖','保持婆婆舒適，送院'],
  quiz:[{q:'有人發燒，以下邊個情況要即刻打 999？',o:['發燒加上神志混亂、叫唔醒或者呼吸困難','體溫 38°C 但精神正常','發燒之後出咗身汗'],why:'發燒本身唔一定危險，但加上神志混亂、昏睡、呼吸困難或者出紅疹按都唔褪色，可能係嚴重感染，要即刻打 999。'}],
  equip:{q:'婆婆發燒、神志混亂，救護員要先量咩？揀啱裝備：',o:['🌡️ 體溫計','🦺 頸套同脊椎板','💨 Ventolin 噴劑','🩹 加壓敷料同繃帶'],why:'救護員會量體溫同其他維生指數，評估有冇嚴重感染嘅跡象。'},
  tips:['發燒時多飲水，穿著輕便衣物','唔好用冰水或者酒精抹身','發燒加神志混亂或呼吸困難，即刻打 999']}
);
const LEVELS_ST=[
 {id:'S1',caseId:'sttrauma',tod:'day',todName:'日間・沙田',cars:22,works:0,jam:1,dash:1,limit:2.0,depot:'st',support:['police']},
 {id:'S2',caseId:'ststroke',tod:'day',todName:'日間・大圍',cars:20,works:0,jam:0,dash:1,limit:2.0,depot:'ts'},
 {id:'S3',caseId:'starrest',tod:'night',todName:'夜晚・沙田',cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'st',support:['moto','fire']},
 {id:'S4',caseId:'sthypo',tod:'dusk',todName:'黃昏・沙田',cars:22,works:1,jam:0,dash:1,limit:2.0,depot:'st'},
 {id:'S5',caseId:'stasthma',tod:'dusk',todName:'黃昏・火炭',cars:22,works:0,jam:1,dash:1,limit:2.0,depot:'st'},
 {id:'S6',caseId:'stcardiac',tod:'rain',todName:'落雨・沙田',cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'ts'},
 {id:'S7',caseId:'stbleed',tod:'day',todName:'日間・沙田',cars:20,works:0,jam:0,dash:1,limit:2.0,depot:'st'},
 {id:'S8',caseId:'stallergy',tod:'dusk',todName:'黃昏・禾輋',cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'st'},
 {id:'S9',caseId:'stseizure',tod:'night',todName:'夜晚・沙田',cars:18,works:0,jam:0,dash:1,limit:2.0,depot:'ts'},
 {id:'S10',caseId:'stbreath',tod:'day',todName:'日間・大圍',cars:20,works:0,jam:0,dash:1,limit:2.0,depot:'ts'},
 {id:'S11',caseId:'stfever',tod:'rain',todName:'落雨・沙田',cars:18,works:0,jam:1,dash:1,limit:2.0,depot:'st'}];

const LEVELS=REGION==='st'?LEVELS_ST:LEVELS_TM; const DEF_H=REGION==='st'?'pwh':'tmh';
const caseOf=lv=>CASES.find(c=>c.id===lv.caseId);

/* ---------- 地點 ---------- */
const HOSPS=REGION==='st'?{pwh:{stop:LMK.ae.stop,door:LMK.ae.door,name:'威爾斯親王醫院'}}:{tmh:{stop:LMK.ae.stop,door:LMK.ae.door,name:'屯門醫院'},poh:{stop:LMK.ae2.stop,door:LMK.ae2.door,name:'博愛醫院'},tsh:{stop:LMK.ae3.stop,door:LMK.ae3.door,name:'天水圍醫院'}};
const DEPOTS=REGION==='st'?{st:{pos:LMK.depot.pos,a:LMK.depot.a},ts:{pos:LMK.depotTS.pos,a:LMK.depotTS.a}}:{tm:{pos:LMK.depot.pos,a:LMK.depot.a},yl:{pos:LMK.depotYL.pos,a:LMK.depotYL.a},tsw:{pos:LMK.depotTSW.pos,a:LMK.depotTSW.a}};
let AE=HOSPS[DEF_H], DEPOT=DEPOTS[REGION==='st'?'st':'tm'];
const PARKED=(LMK.parkedAmb||[]).map(([[x,z],ang],i)=>{ const a=ambulance(['A245','A272'][i]||'A281'); a.userData.body.scale.setScalar(0.85); a.position.set(x,0.34,z); a.rotation.y=ang;
  a.userData.pB.intensity=a.userData.pR.intensity=0; a.userData.pB.visible=a.userData.pR.visible=false; a.userData.len=6; return {m:a,home:[x,z,ang]}; });

/* ---------- 畫面可見範圍：車同行人只喺鏡頭睇唔到嘅地方出現／消失 ---------- */
function spawnOK(x,z,r){ if(S.mode==='menu'||S.spawnFree) return true; if(inView(x,z,r)) return false; const c=S.car, dx=x-c.x, dz=z-c.z;
  return dx*Math.sin(c.a)+dz*Math.cos(c.a)<-10||Math.hypot(dx,dz)>150; } // 喺車後面或者好遠先出現
const FR=new THREE.Frustum(), FRM=new THREE.Matrix4(), FRS=new THREE.Sphere(new THREE.Vector3(),8);
function updFrustum(){ cam.updateMatrixWorld(); FRM.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse); FR.setFromProjectionMatrix(FRM); }
function inView(x,z,r=8){ r+=14; // 預留位：鏡頭轉動時都唔會見到出現／消失
  if(Math.hypot(x-cam.position.x,z-cam.position.z)>scene.fog.far+30) return false; FRS.center.set(x,2,z); FRS.radius=r; return FR.intersectsSphere(FRS); }
/* ---------- 交通車輛 ---------- */
/* ---------- 香港交通工具（參考相片：雙層巴士、綠色小巴、紅／綠的士、輕鐵） ---------- */
const VT={}; // 貼圖快取
function vtex(key,w,h,draw){ if(!VT[key]){ const t=canvasTex(w,h,draw,false); VT[key]=new THREE.MeshStandardMaterial({map:t,roughness:0.55}); } return VT[key]; }
// 六面盒：[+x, -x, 上, 下, 前(+z), 後(-z)]
function vbox(w,h,d,mats,parent,x,y,z,cast=true){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats); m.position.set(x,y,z); m.castShadow=cast; m.receiveShadow=true; parent.add(m); return m; }
const solid=c=>M(c,{r:0.5});
function wheelsAt(body,list,r=0.45,wd=0.35){ list.forEach(([x,z])=>{ const w=add(cyl(r,r,wd,12),M(C.dark),body,x,r,z,false); w.rotation.z=Math.PI/2;
  add(cyl(r*0.55,r*0.55,wd+0.02,10),M(0xc9ced4),body,x,r,z,false).rotation.z=Math.PI/2; }); }
const led=(g,txt,x,y,size,col)=>{ g.fillStyle=col; g.font='bold '+size+'px sans-serif'; g.textBaseline='middle'; g.fillText(txt,x,y); };

/* 雙層巴士：紅色（銀色斜紋）／香檳金色（舊款） */
function busSide(style,frontLeft){ return vtex('bus'+style+frontLeft,1024,384,(g,W,H)=>{
  const X=x=>frontLeft?x:W-x, rect=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); g.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
  if(style==='red'){ g.fillStyle='#e8343a'; g.fillRect(0,0,W,H);
    g.fillStyle='#c3c3c3'; g.beginPath(); g.moveTo(X(470),H); g.lineTo(X(560),H); g.lineTo(X(860),0); g.lineTo(X(800),0); g.fill(); // 銀色斜紋
    g.fillStyle='#16181c'; rect(20,40,950,150); rect(60,220,700,320); rect(830,220,1000,320); rect(860,40,1010,180); // 上下層窗、車頭
  } else { g.fillStyle='#bba98a'; g.fillRect(0,0,W,H);
    g.fillStyle='#1c1e22'; rect(40,40,1000,150); rect(260,220,1000,330); rect(30,220,150,360); rect(170,220,240,360);
    g.fillStyle='#f4f4f0'; rect(300,165,940,210); g.fillStyle='#2a8f4a'; g.font='bold 30px sans-serif'; g.textAlign='center'; g.fillText('環保人人想',X(620),188); }
  g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(0,H-14,W,14); }); }
function busFront(style){ return vtex('busF'+style,256,384,(g,W,H)=>{ g.fillStyle=style==='red'?'#e8343a':'#bba98a'; g.fillRect(0,0,W,H);
  g.fillStyle='#16181c'; g.fillRect(14,14,W-28,140); g.fillRect(14,170,W-28,150);
  g.fillStyle='#000'; g.fillRect(36,170,W-72,50); led(g,style==='red'?'屯門 60X':'天瑞 69X',48,196,30,style==='red'?'#ffa31a':'#3ddc6a');
  g.fillStyle=style==='red'?'#c8c8c8':'#a8977a'; g.fillRect(10,330,W-20,22); g.fillStyle='#fffbe8'; g.fillRect(20,334,34,14); g.fillRect(W-54,334,34,14); }); }
function busModel(){ const g=new THREE.Group(), body=new THREE.Group(); g.add(body); const st=Math.random()<0.6?'red':'gold';
  const bc=st==='red'?'#e8343a':'#bba98a', bd=st==='red'?'#b3262b':'#94866b';
  const base=solid(st==='red'?0xe8343a:0xbba98a), back=vtex('busB2'+st,256,384,(c,W,H)=>{ c.fillStyle=bc; c.fillRect(0,0,W,H);
    c.fillStyle='#16181c'; c.fillRect(28,30,W-56,84);                                   // 上層車尾窗
    c.fillStyle='rgba(255,255,255,.14)'; c.beginPath(); c.moveTo(40,104); c.lineTo(90,38); c.lineTo(120,38); c.lineTo(70,104); c.fill();
    c.fillStyle='#16181c'; c.fillRect(150,126,82,30); led(c,'60X',162,142,22,'#ffb020');     // 路線牌
    c.fillStyle='#16181c'; c.fillRect(28,170,W-56,56);                                  // 下層車尾窗
    c.fillStyle=bd; c.fillRect(34,240,W-68,84); c.fillStyle='rgba(0,0,0,.28)'; for(let y=250;y<318;y+=11) c.fillRect(48,y,W-96,5);   // 引擎蓋散熱格
    [8,W-30].forEach(x=>{ c.fillStyle='#ff3030'; c.fillRect(x,236,22,34); c.fillStyle='#ffa31a'; c.fillRect(x,274,22,22); c.fillStyle='#f4f4f4'; c.fillRect(x,300,22,16); });
    c.fillStyle='#ffd400'; c.fillRect(92,334,72,22); c.fillStyle='#111'; c.font='bold 16px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('TM 60X',128,346); c.textAlign='left';
    c.fillStyle='#1c1e22'; c.fillRect(0,362,W,22); });
  const roof=vtex('busT2'+st,256,1024,(c,W,H)=>{ c.fillStyle=bc; c.fillRect(0,0,W,H);   // 車頂：同車身一樣顏色，只加深色線條
    c.strokeStyle=bd; c.lineWidth=6; c.strokeRect(10,10,W-20,H-20);
    c.lineWidth=3; for(let y=60;y<H-20;y+=90){ c.beginPath(); c.moveTo(22,y); c.lineTo(W-22,y); c.stroke(); }
    [[150,220],[620,220]].forEach(([y,h])=>{ c.lineWidth=6; c.strokeRect(56,y,W-112,h); c.lineWidth=3; for(let yy=y+18;yy<y+h-10;yy+=18){ c.beginPath(); c.moveTo(72,yy); c.lineTo(W-72,yy); c.stroke(); }
      c.lineWidth=5; c.beginPath(); c.arc(W/2,y+h/2,34,0,7); c.stroke(); });   // 冷氣機
    [430,900].forEach(y=>{ c.lineWidth=5; c.strokeRect(86,y,84,70); });        // 太平門
  });

  vbox(2.55,4.3,11.2,[busSide(st,true),busSide(st,false),roof,base,busFront(st),back],body,0,2.6,0);
  wheelsAt(body,[[-1.2,3.6],[1.2,3.6],[-1.2,-2.6],[1.2,-2.6],[-1.2,-3.9],[1.2,-3.9]],0.56,0.4);
  body.children[0].castShadow=true; scene.add(g); g.userData.len=11.2; addCarLights(g,body,'bus'); return g; }

/* 車燈：尾燈（剎車時好光）、頭燈（夜晚／落雨開），私家車加車牌；材質共用，靠換材質開關 */
const CARL={night:false,
  tlOff:new THREE.MeshStandardMaterial({color:0x8a1a1a,roughness:0.4}), tlRun:new THREE.MeshBasicMaterial({color:0xa01818}), tlOn:new THREE.MeshBasicMaterial({color:0xff2a2a}),
  hlOff:new THREE.MeshStandardMaterial({color:0xe9eef2,roughness:0.2}), hlOn:new THREE.MeshBasicMaterial({color:0xfff4cf}),
  plateR:new THREE.MeshStandardMaterial({color:0xffd400,roughness:0.6}), plateF:new THREE.MeshStandardMaterial({color:0xf4f4f4,roughness:0.6}),
  glow:null, G:new THREE.BoxGeometry(1,1,1), P:new THREE.PlaneGeometry(1,1)};
CARL.glow=new THREE.MeshBasicMaterial({map:canvasTex(64,128,(g,w,h)=>{ const gr=g.createRadialGradient(w/2,h*0.9,4,w/2,h*0.55,h*0.6); gr.addColorStop(0,'rgba(255,240,200,.9)'); gr.addColorStop(1,'rgba(255,240,200,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); },false),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.55});
function addCarLights(g,body,kind){ if(CARL.skip){ g.userData.kind=kind; return; } const L=g.userData.len||4.4, hw=kind==='bus'?1.05:kind==='minibus'?0.88:0.8, ty=kind==='bus'?1.0:kind==='minibus'?0.95:1.05, z=L/2+0.03;
  const tl=[-1,1].map(s=>{ const m=new THREE.Mesh(CARL.G,CARL.tlOff); m.scale.set(kind==='bus'?0.3:0.36,kind==='bus'?0.5:0.2,0.08); m.position.set(s*hw,ty,-z); body.add(m); return m; });
  const hl=[-1,1].map(s=>{ const m=new THREE.Mesh(CARL.G,CARL.hlOff); m.scale.set(0.36,0.18,0.08); m.position.set(s*hw,kind==='bus'?0.85:0.9,z); body.add(m); return m; });
  if(kind==='car'){ const pr=new THREE.Mesh(CARL.G,CARL.plateR); pr.scale.set(0.62,0.18,0.04); pr.position.set(0,0.78,-z); body.add(pr); const pf=new THREE.Mesh(CARL.G,CARL.plateF); pf.scale.set(0.62,0.18,0.04); pf.position.set(0,0.66,z); body.add(pf); }
  const gl=new THREE.Mesh(CARL.P,CARL.glow); gl.rotation.x=-Math.PI/2; gl.scale.set(4.2,9,1); gl.position.set(0,0.09,z+4.6); gl.visible=false; gl.renderOrder=1; body.add(gl);
  g.userData.lt={tl,hl,gl,brk:null,night:null}; g.userData.kind=kind; }
// 每格：剎車燈、夜晚頭燈（只喺狀態改變時先換材質）
function carLights(m,brake){ const u=m.userData.lt; if(!u) return; const n=CARL.night;
  if(u.night!==n){ u.night=n; u.hl.forEach(h=>h.material=n?CARL.hlOn:CARL.hlOff); u.gl.visible=n; u.brk=null; }
  if(u.brk!==brake){ u.brk=brake; u.tl.forEach(h=>{ h.material=brake?CARL.tlOn:n?CARL.tlRun:CARL.tlOff; h.scale.y=(brake?1.25:1)*(h.userData.sy||(h.userData.sy=h.scale.y)); }); } }
/* 綠色專線小巴：米色車身、綠色車頂、車頭頂電子牌 */
function minibusModel(body){
  const side=f=>vtex('mb'+f,512,192,(g,W,H)=>{ const X=x=>f?x:W-x; g.fillStyle='#f1e2b4'; g.fillRect(0,0,W,H); g.fillStyle='#2fb07a'; g.fillRect(0,0,W,46);
    g.fillStyle='#fff'; g.font='bold 18px sans-serif'; g.textAlign='center'; g.fillText('公共小型巴士十九座位',X(300),30);
    g.fillStyle='#1c1e22'; const a=X(30),b=X(400); g.fillRect(Math.min(a,b),56,Math.abs(b-a),60); const c=X(410),d=X(480); g.fillRect(Math.min(c,d),56,Math.abs(d-c),70);
    g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(0,H-10,W,10); });
  const front=vtex('mbF',256,192,(g,W,H)=>{ g.fillStyle='#f1e2b4'; g.fillRect(0,0,W,H); g.fillStyle='#2fb07a'; g.fillRect(0,0,W,46); g.fillStyle='#1c1e22'; g.fillRect(14,52,W-28,70);
    g.fillStyle='#d9d9d9'; g.fillRect(24,140,40,18); g.fillRect(W-64,140,40,18); g.fillStyle='#2a2a2a'; g.fillRect(84,140,W-168,22); });
  const green=solid(0x2fb07a), cream=solid(0xf1e2b4);
  // 車尾：大後窗、綠色車頂、尾燈位、黃色車牌、後泵把（參考香港綠色專線小巴）
  const rear=vtex('mbB2',256,192,(g,W,H)=>{ g.fillStyle='#f1e2b4'; g.fillRect(0,0,W,H); g.fillStyle='#2fb07a'; g.fillRect(0,0,W,40);
    g.fillStyle='#1c1e22'; g.fillRect(22,46,W-44,70); g.fillStyle='rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(40,112); g.lineTo(80,50); g.lineTo(100,50); g.lineTo(60,112); g.fill();
    g.fillStyle='#111'; g.fillRect(W/2-46,50,92,22); led(g,'44M',W/2-38,61,18,'#3ddc6a');
    g.fillStyle='#c9bb8e'; g.fillRect(W/2-1,118,2,40); g.fillStyle='#8a8a8a'; g.fillRect(W/2+10,134,18,5);
    g.fillStyle='#2fb07a'; g.font='bold 15px sans-serif'; g.textAlign='center'; g.fillText('公共小型巴士',W/2,132);
    g.fillStyle='#ffd400'; g.fillRect(W/2-36,146,72,20); g.fillStyle='#111'; g.font='bold 15px sans-serif'; g.fillText('MB 2846',W/2,161);
    g.fillStyle='#2a2a2a'; g.fillRect(0,170,W,22); });
  vbox(2.3,2.5,7.0,[side(true),side(false),green,cream,front,rear],body,0,1.55,0);
  vbox(1.5,0.5,0.8,[green,green,green,green,vtex('mbLed',128,48,(g,W,H)=>{ g.fillStyle='#2fb07a'; g.fillRect(0,0,W,H); g.fillStyle='#111'; g.fillRect(8,6,W-16,H-12); led(g,'44M 屯門',16,24,22,'#ffa31a'); }),green],body,0,3.0,3.0,false);
  wheelsAt(body,[[-1.05,2.3],[1.05,2.3],[-1.05,-2.2],[1.05,-2.2]],0.48,0.35); }

/* 的士：市區紅的（銀頂）／新界綠的（白頂），車頂 TAXI 牌 */
function taxiModel(body,green){
  const c=green?'#2bb04a':'#e3262e', top=green?0xf4f4f4:0xc9ccd0;
  const side=f=>vtex('tx'+green+f,256,96,(g,W,H)=>{ const X=x=>f?x:W-x; g.fillStyle=c; g.fillRect(0,0,W,H); g.fillStyle='#fff'; g.font='bold 20px sans-serif'; g.textAlign='center'; g.fillText('的士',X(150),36); g.font='bold 16px sans-serif'; g.fillText('TAXI',X(150),58);
    g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(0,H-10,W,10); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(X(128)-1,10,2,H-24); });
  const front=vtex('txF'+green,256,96,(g,W,H)=>{ g.fillStyle=c; g.fillRect(0,0,W,H); g.fillStyle='#fff6d0'; g.fillRect(14,24,46,22); g.fillRect(W-60,24,46,22); g.fillStyle='#222'; g.fillRect(80,30,W-160,26); g.fillStyle='#fff'; g.fillRect(90,62,W-180,22); });
  const base=solid(green?0x2bb04a:0xe3262e);
  const rear=vtex('txB'+green,256,96,(g,W,H)=>{ g.fillStyle=c; g.fillRect(0,0,W,H); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(10,8,W-20,2);
    g.fillStyle='#fff'; g.font='bold 18px sans-serif'; g.textAlign='center'; g.fillText('的士 TAXI',W/2,30);
    g.fillStyle='#ffd400'; g.fillRect(W/2-38,44,76,22); g.fillStyle='#111'; g.font='bold 16px sans-serif'; g.fillText(green?'NT 5813':'HK 3927',W/2,61);
    g.fillStyle='#2a2a2a'; g.fillRect(0,76,W,20); });
  vbox(2.15,1.0,4.5,[side(true),side(false),base,base,front,rear],body,0,0.95,0);
  const roofM=solid(top), glass=M(C.glass,{r:0.2});
  vbox(1.9,0.85,green?2.3:2.9,[glass,glass,roofM,roofM,glass,glass],body,0,1.85,green?-0.25:-0.45);
  vbox(1.92,0.12,green?2.34:2.94,roofM,body,0,2.29,green?-0.25:-0.45,false);
  vbox(0.9,0.3,0.4,[solid(0xffffff),solid(0xffffff),solid(0xffffff),solid(0xffffff),vtex('taxiSign',128,48,(g,W,H)=>{ g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.fillStyle='#d8202a'; g.font='bold 34px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('TAXI',W/2,H/2+2); }),solid(0xffffff)],body,0,2.5,-0.2,false);
  wheelsAt(body,[[-1.05,1.5],[1.05,1.5],[-1.05,-1.5],[1.05,-1.5]]); }

function carModel(kind){
  if(kind==='bus') return busModel();
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  if(kind==='minibus') minibusModel(body);
  else if(kind==='taxi') taxiModel(body,Math.random()<0.5);
  else { const col=[0x7fb8ff,0xffb3c1,0xc3a6ff,0xfff1a8,0xa8e6cf,0xe9edf2,0x5b6270][Math.random()*7|0];
    add(rbox(2.2,1.0,4.4,0.45),M(col),body,0,0.95,0); add(rbox(1.9,0.85,2.3,0.4),M(col),body,0,1.75,-0.2);
    add(new THREE.BoxGeometry(1.94,0.55,2.0),M(C.glass,{r:0.2}),body,0,1.78,-0.2,false);
    wheelsAt(body,[[-1.05,1.5],[1.05,1.5],[-1.05,-1.5],[1.05,-1.5]]); }
  g.traverse(o=>{ if(o.isMesh) o.castShadow=false; }); body.children[0].castShadow=true;
  if(kind==='minibus') g.userData.len=7.0;
  addCarLights(g,body,kind);
  scene.add(g); return g; }

/* 輕鐵：銀白車身、紅色腰線、紫綠間條、車頭黑色擋風、橙字路線牌、紅色集電弓 */
function lrtSide(cabLeft){ return vtex('lrt'+cabLeft,1024,256,(g,W,H)=>{ const X=x=>cabLeft?x:W-x, rect=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); g.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
  g.fillStyle='#e9ebee'; g.fillRect(0,0,W,H);
  g.fillStyle='#c8102e'; rect(220,44,1024,62); g.fillStyle='#c8102e'; rect(196,44,232,62);
  g.fillStyle='#1f2328'; rect(240,70,1010,152); for(let x=330;x<1010;x+=96){ g.fillStyle='#cfd3d8'; rect(x,70,x+8,152); }
  for(let y=160;y<230;y+=6){ g.fillStyle=y%12?'#d7dade':'#c3c7cc'; rect(230,y,1024,y+3); }
  g.fillStyle='#b9a6e6'; rect(230,190,1024,195); g.fillStyle='#9bd23a'; rect(230,198,1024,203); g.fillStyle='#6c2c91'; rect(230,206,1024,210);
  // 車頭位置
  g.fillStyle='#f5f6f7'; rect(0,0,230,236); g.fillStyle='#1f2328'; rect(40,70,170,170);
  g.strokeStyle='#b9a6e6'; g.lineWidth=5; g.beginPath(); g.moveTo(X(20),205); g.quadraticCurveTo(X(140),185,X(230),192); g.stroke();
  g.strokeStyle='#9bd23a'; g.beginPath(); g.moveTo(X(20),213); g.quadraticCurveTo(X(140),195,X(230),200); g.stroke();
  g.strokeStyle='#6c2c91'; g.beginPath(); g.moveTo(X(20),221); g.quadraticCurveTo(X(140),203,X(230),208); g.stroke();
  g.fillStyle='#222'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.fillText('1018',X(205),165);
  g.fillStyle='#4a4f56'; g.fillRect(0,236,W,20); }); }
const lrtFront=()=>vtex('lrtF',256,256,(g,W,H)=>{ g.fillStyle='#f5f6f7'; g.fillRect(0,0,W,H); g.fillStyle='#1f2328'; g.fillRect(18,10,W-36,150);
  g.fillStyle='#111'; g.fillRect(30,16,W-60,40); led(g,'元朗 610',44,37,26,'#ff8a1f'); led(g,'063',36,72,18,'#ff8a1f');
  g.fillStyle='#c8102e'; g.fillRect(40,168,W-80,26); g.fillStyle='#fff6d8'; g.fillRect(30,206,34,18); g.fillRect(W-64,206,34,18);
  g.fillStyle='#b9a6e6'; g.fillRect(0,228,W,4); g.fillStyle='#9bd23a'; g.fillRect(0,234,W,4); g.fillStyle='#4a4f56'; g.fillRect(0,240,W,16); });
function tramModel(){ const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const white=solid(0xeef0f2), grey=solid(0x4a4f56);
  [[6.4,1],[-6.4,-1]].forEach(([z,dir])=>{ // 兩卡背對背，兩頭都係車頭
    const fr=lrtFront(); const mats=dir>0?[lrtSide(true),lrtSide(false),white,grey,fr,white]:[lrtSide(false),lrtSide(true),white,grey,white,fr];
    vbox(2.65,3.3,12.4,mats,body,0,2.05,z);
    add(new THREE.BoxGeometry(1.6,0.45,2.2),solid(0x5c6168),body,0,3.95,z-dir*3,false);  // 冷氣機
    add(new THREE.BoxGeometry(1.6,0.45,2.2),solid(0x5c6168),body,0,3.95,z-dir*0.4,false); });
  add(new THREE.BoxGeometry(2.4,3.0,0.6),grey,body,0,2.0,0,false);
  // 集電弓（紅色）同架空電線接觸
  const pm=solid(0xa3262e); const p1=add(new THREE.BoxGeometry(0.12,0.12,2.4),pm,body,0,4.8,5.0,false); p1.rotation.x=-0.75;
  const p2=add(new THREE.BoxGeometry(0.12,0.12,2.4),pm,body,0,4.8,3.6,false); p2.rotation.x=0.75; add(new THREE.BoxGeometry(1.8,0.1,0.25),solid(0x333333),body,0,5.65,4.3,false);
  body.children[0].castShadow=true; scene.add(g); g.userData.len=25; return g; }

// 停車場嘅車
const PARKM=[]; CARL.skip=true; parked.forEach(([x,z,a],k)=>{ const c=carModel(['car','car','taxi','minibus'][k%4]); c.position.set(x,0.34,z); c.rotation.y=a; PARKM.push(c); }); CARL.skip=false;   // 遠過 170 米唔畫
const cars=[]; const CAR_N=26;
function placeCar(c,nearX,nearZ){
  for(let tries=0;tries<40;tries++){
    const r=MAP.roads[Math.random()*MAP.roads.length|0]; if(r.closed) continue;
    const i=1+(Math.random()*(r.n.length-1)|0); const a=r.n[i-1], b=r.n[i];
    const A=NODES[a]; const d=Math.hypot(A[0]-nearX,A[1]-nearZ); if(d<60||d>340) continue;
    const fr=Math.random()<0.5?a:b, to=fr===a?b:a, t0=Math.random()*0.6; const P=NODES[fr],Q=NODES[to], px=P[0]+(Q[0]-P[0])*t0, pz=P[1]+(Q[1]-P[1])*t0;
    if(cars.some(o=>o!==c&&o.pose&&Math.hypot(o.pose.x-px,o.pose.z-pz)<16)) continue; // 唔好喺其他車上面出現
    if(!spawnOK(px,pz)) continue; // 唔好喺鏡頭前面突然出現
    Object.assign(c,{from:fr,to,road:r,t:t0,v:7+Math.random()*3,yield:0,pose:null,blockedBy:null}); return true; }
  return false;
}
function nextEdge(c){
  const opts=ADJ[c.to].filter(e=>e[0]!==c.from&&!e[2].closed);
  if(!opts.length){ c.t=1; c.waitEnd=true; return; } // 地圖盡頭：停喺度，等鏡頭睇唔到先喺第二度出現
  const e=opts[Math.random()*opts.length|0];
  c.from=c.to; c.to=e[0]; c.road=e[2]; c.t=0;
}
const HAZM=new THREE.MeshBasicMaterial({color:0xffa31a}), HAZG=new THREE.BoxGeometry(0.42,0.26,0.12);
function yieldHaz(k,on,t){ // 死火燈：車頭兩盞、車尾兩盞
  if(on&&!k.yh){ const L=k.m.userData.len||4.5, hz=L/2+0.03, hx=L>10?1.05:L>6?0.9:0.85, hy=L>10?0.9:1.0, par=k.m.children[0]||k.m;
    k.yh={on:false,m:[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,z])=>add(HAZG,HAZM,par,x*hx,hy,z*hz,false))}; }
  if(!k.yh) return; k.yh.on=on; const vis=on&&Math.floor(t*3)%2===0; k.yh.m.forEach(h=>h.visible=vis); }
function carPose(c){
  const A=NODES[c.from],B=NODES[c.to]; const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1; const ux=dx/L,uz=dz/L;
  const off=c.yield>0?c.road.w/2-(c.m.userData.len?1.9:1.5):laneOff(c.road);
  c.off=(c.off??off)+(off-(c.off??off))*0.08;
  return {x:A[0]+dx*c.t+uz*c.off, z:A[1]+dz*c.t-ux*c.off, a:Math.atan2(ux,uz), L};
}
/* ---------- 行人 ---------- */
const peds=[]; const PED_N=34;
/* 巴士站等車嘅人：只擺最近兩個巴士站，每個三個人（共用 6 個模型） */
const BUSW={pool:[],t:0};
function busWaitTick(dt){ if(!NEON||!NEON.stops.length) return; if((BUSW.t-=dt)>0) return; BUSW.t=1;
  if(!BUSW.pool.length) for(let i=0;i<6;i++){ const m=pedModel(); m.visible=false; BUSW.pool.push(m); }
  const c=S.car, show=S.mode==='drive'||S.mode==='seq'||S.mode==='hseq';
  const near=show?NEON.stops.map(s=>[s,Math.hypot(s[0]-c.x,s[1]-c.z)]).filter(q=>q[1]<160).sort((a,b)=>a[1]-b[1]).slice(0,2):[];
  BUSW.pool.forEach((m,i)=>{ const q=near[Math.floor(i/3)]; if(!q){ m.visible=false; return; } const [x,z,nx,nz,ux,uz]=q[0], k=i%3-1, j=(i*7)%5*0.08;
    m.visible=true; m.position.set(x+ux*(k*1.25+j)-nx*(0.25+j),0.15,z+uz*(k*1.25+j)-nz*(0.25+j)); m.rotation.set(0,Math.atan2(-nx,-nz)+(k*0.35),0); }); }
// 行人跳開：跳去佢本身嗰邊（遠離車頭），落點唔可以係建築物
function pedDodge(p,c,lat){ const rx=Math.cos(c.a), rz=-Math.sin(c.a); let side=lat>=0?1:-1; const dist=VSPEC.kw*1.3+2.2-Math.abs(lat)*0.5;
  let x1=p.pos[0]+rx*side*dist, z1=p.pos[1]+rz*side*dist; if(cellAt(x1,z1)&2){ side=-side; x1=p.pos[0]+rx*side*(dist+Math.abs(lat)*2); z1=p.pos[1]+rz*side*(dist+Math.abs(lat)*2); }
  p.mode='jump'; p.jmp={t:0,x0:p.pos[0],z0:p.pos[1],x1,z1,side,ry:Math.atan2(rx*side,rz*side)}; }
function placePed(p,nearX,nearZ){
  for(let tries=0;tries<50;tries++){
    if(!S.noCross&&Math.random()<0.4){ const c=MAP.crossings[Math.random()*MAP.crossings.length|0]; const d=Math.hypot(c.p[0]-nearX,c.p[1]-nearZ); if(d<60||d>280) continue; if(!spawnOK(c.p[0],c.p[1],4)) continue;
      Object.assign(p,{mode:'cross',cx:c.p[0],cz:c.p[1],nx:c.n[0],nz:c.n[1],half:c.half,s:-c.half,dir:1,wait:Math.random()*4,node:SIGNAL[c.node]?c.node:null,ang:c.ang}); return true; }
    const r=MAP.roads[Math.random()*MAP.roads.length|0]; if(r.bridge) continue;
    const A=NODES[r.n[0]],B=NODES[r.n[1]]; const d=Math.hypot((A[0]+B[0])/2-nearX,(A[1]+B[1])/2-nearZ); if(d<50||d>280) continue;
    const L=Math.hypot(B[0]-A[0],B[1]-A[1]); const side=Math.random()<0.5?1:-1; if(!spawnOK(A[0],A[1],4)||!spawnOK(B[0],B[1],4)) continue;
    const lo=SIGNAL[r.n[0]]?CLR[r.n[0]]+5:1, hi=L-(SIGNAL[r.n[1]]?CLR[r.n[1]]+5:1); if(hi-lo<6) continue;
    if(r.elev) continue; Object.assign(p,{mode:'walk',A,B,L,s:lo+Math.random()*(hi-lo),lo,hi,dir:Math.random()<0.5?1:-1,off:(r.w/2+1.9)*side}); return true; }
  return false;
}
const PCOL=[0x7ec8e3,0xa78bfa,0xf9a8d4,0x86efac,0xfcd34d,0xfda4af,0x93c5fd];
const PG={body:new THREE.CylinderGeometry(0.42,0.5,1.0,10),head:new THREE.SphereGeometry(0.6,12,10),hair:new THREE.SphereGeometry(0.62,12,8,0,Math.PI*2,0,Math.PI/2),leg:new THREE.CylinderGeometry(0.15,0.15,0.6,6)};
const PM={skin:M(C.skin),hair:M(C.hair),leg:M(0x50586a)}, PCM=PCOL.map(c=>M(c));
function pedModel(){ // 簡化行人：5 件，唔投影，慳手機效能
  const g=new THREE.Group(); const mk=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); g.add(m); return m;};
  mk(PG.body,PCM[Math.random()*PCM.length|0],0,1.05,0); mk(PG.head,PM.skin,0,2.05,0); mk(PG.hair,PM.hair,0,2.1,-0.04);
  const legL=mk(PG.leg,PM.leg,-0.2,0.3,0), legR=mk(PG.leg,PM.leg,0.2,0.3,0);
  g.userData={legL,legR}; g.scale.setScalar(0.9); scene.add(g); return g; }

/* ---------- 高架路：車輛高度同斜度 ---------- */
function groundPose(m,x,y0,z,a,len){ const h=ELEV(x,z); m.rotation.order='YXZ'; m.position.set(x,y0+h,z); m.rotation.y=a;
  if(h>0||ELEV(x+Math.sin(a)*2,z+Math.cos(a)*2)>0){ const k=(len||4)/2, hf=ELEV(x+Math.sin(a)*k,z+Math.cos(a)*k), hb=ELEV(x-Math.sin(a)*k,z-Math.cos(a)*k); m.rotation.x=-Math.atan2(hf-hb,2*k); } else m.rotation.x=0; }
/* ---------- 輕鐵 ---------- */
const trams=REGION!=='tm'?[]:[0,1,2,3].map(k=>({L:TRAM,m:tramModel(),dir:k%2?-1:1,s:k*TRAM.len/4,wait:0,cur:9})).concat([0,1].map(k=>({L:TRAM2,m:tramModel(),dir:k%2?-1:1,s:k*TRAM2.len/2+20,wait:0,cur:9}))).concat([0,1].map(k=>({L:TRAM3,m:tramModel(),dir:k%2?-1:1,s:k*TRAM3.len/2+20,wait:0,cur:9})));
function tramTick(dt){ const c=S.car, tt=clock.elapsedTime, SV=window.__SV||[];
  for(const T of trams){
    let target=9; const TL=T.L; const p0=tramAt(T.s,TL); const off=T.dir>0?3.2:-3.2; // 靠左：同方向偏左
    const fx=Math.sin(p0.a)*T.dir, fz=Math.cos(p0.a)*T.dir, lx=fz, lz=-fx; const px=p0.x+lx*3.2, pz=p0.z+lz*3.2;
    const ex=c.x-px, ez=c.z-pz, ah=ex*fx+ez*fz; if(ah>0&&ah<22&&Math.abs(ex*lx+ez*lz)<3.6) target=0;
    for(const o of trams) if(o!==T&&o.L===T.L&&o.dir===T.dir){ const d=(o.s-T.s)*T.dir; if(d>0&&d<34) target=0; }
    if(T.pose) for(const o of cars){ if(!o.pose) continue; const qx=o.pose.x-T.pose.x, qz=o.pose.z-T.pose.z; const sa=Math.sin(T.pose.a), ca=Math.cos(T.pose.a); const al=qx*sa+qz*ca, ac=qx*ca-qz*sa; if(al>12&&al<24&&Math.abs(ac)<3) { target=0; break; } }
    // 紅燈
    for(let i=0;i<TL.seq.length;i++){ const k=TL.seq[i]; if(!SIGNAL[k]) continue; const rem=(TL.cum[i]-T.s)*T.dir, sd=CLR[k]+4.6+12.5;
      if(rem>sd-1&&rem<sd+20){ const st=lightState(k,p0.a,tt); if(st!=='g') target=Math.min(target,Math.max(0,(rem-sd)*0.8)); } }
    // 讓救護車：前面或者下一個路口附近有響警號嘅救護車就停
    if(T.pose) for(const sv of SV){ const qx=sv.x-T.pose.x, qz=sv.z-T.pose.z, d=Math.hypot(qx,qz); const ah=qx*Math.sin(T.pose.a)+qz*Math.cos(T.pose.a); if(d<38&&ah>-14) { target=0; break; } }
    const ds=(TL.lrt-T.s)*T.dir; if(T.wait>0){ T.wait-=dt; target=0; } else if(ds>0&&ds<0.5+T.cur*dt){ T.wait=5; T.s=TL.lrt; target=0; }
    else if(ds>0&&ds<20) target=Math.min(target,2+ds*0.35);
    T.cur+=(target-T.cur)*Math.min(1,dt*(target<T.cur?4:1)); T.s+=T.cur*T.dir*dt;
    if(T.s>TL.len+40) T.s=-40; if(T.s<-40) T.s=TL.len+40;
    const p=tramAt(T.s,TL); const ang=T.dir>0?p.a:p.a+Math.PI; const ux=Math.sin(ang), uz=Math.cos(ang);
    const x=p.x+uz*3.2, z=p.z-ux*3.2; T.pose={x,z,a:ang}; T.m.position.set(x,0.12,z); T.m.rotation.y=ang;
    T.m.visible=T.s>-5&&T.s<TL.len+5; if(!T.m.visible) T.pose=null; } }

/* ---------- 狀態 ---------- */
const S={mode:'menu',kase:null,step:0,car:{x:0,z:0,a:0,v:0},t0:0,tScene:0,tHosp:0,collided:false,collisions:0,
  target:null,route:null,routeT:0,seq:0,hold:{L:false,R:false,G:false,B:false},siren:false,camYaw:0,stars:0,ideal:0,lastHit:-9};
const routeMat=new THREE.MeshBasicMaterial({color:0xffd6a8,transparent:true,opacity:0.6,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6});
let routeMesh=null;
function drawRoute(pts0){   // 連續嘅地面提示線：每 1.5 米一點，轉角用斜接，唔會斷開
  if(routeMesh){scene.remove(routeMesh);routeMesh.geometry.dispose();routeMesh=null;}
  const pts=[]; for(let i=0;i<pts0.length;i++){ const a=pts0[i]; if(i===0){ pts.push(a); continue; } const p=pts0[i-1], L=Math.hypot(a[0]-p[0],a[1]-p[1]); if(L<0.3) continue; const n=Math.max(1,Math.ceil(L/1.5)); for(let k=1;k<=n;k++) pts.push([p[0]+(a[0]-p[0])*k/n,p[1]+(a[1]-p[1])*k/n]); }
  if(pts.length<2) return; const hw=1.25, pos=[], idx=[];
  for(let i=0;i<pts.length;i++){ const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)]; let dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1; dx/=L; dz/=L;
    let m=1; if(i>0&&i<pts.length-1){ const p=pts[i-1],q=pts[i]; let ux=q[0]-p[0],uz=q[1]-p[1]; const ul=Math.hypot(ux,uz)||1; ux/=ul; uz/=ul; const cosv=ux*dx+uz*dz; m=Math.min(2,1/Math.max(0.5,cosv)); }
    const nx=-dz*hw*m, nz=dx*hw*m, p=pts[i], y=0.3+ELEV(p[0],p[1]); pos.push(p[0]+nx,y,p[1]+nz, p[0]-nx,y,p[1]-nz);
    if(i>0){ const k=i*2; idx.push(k-2,k-1,k, k-1,k+1,k); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); routeMesh=new THREE.Mesh(g,routeMat); routeMesh.renderOrder=3; scene.add(routeMesh);
}
function routeAhead(){ const R=S.route; if(!R) return null; const pr=routeProj(); const c=S.car; if(!pr) return R.pts; const A=R.pts[pr.i-1],B=R.pts[pr.i]; const P=[A[0]+(B[0]-A[0])*pr.t,A[1]+(B[1]-A[1])*pr.t];
  return [[c.x,c.z],P,...R.pts.slice(pr.i)]; }   // 由車而家位置開始、已行過嘅部分唔畫
const ring=add(new THREE.TorusGeometry(5,0.45,12,48),M(0xff7a1a,{e:0x662200}),scene,0,0.5,0,false); ring.rotation.x=Math.PI/2; ring.visible=false;
const beacon=add(new THREE.CylinderGeometry(1.2,1.2,40,16,1,true),new THREE.MeshBasicMaterial({color:0xff7a1a,transparent:true,opacity:0.22,depthWrite:false,side:THREE.DoubleSide}),scene,0,20,0,false); beacon.visible=false;
const arrow=new THREE.Group(); arrow.visible=false;   // 舊浮動箭嘴已停用（唔再加入場景），改用路口藍色霓虹指示牌
{ const sh=(k)=>{ const g=new THREE.Shape(); g.moveTo(0,2.2*k); g.lineTo(1.7*k,0.2*k); g.lineTo(0.6*k,0.2*k); g.lineTo(0.6*k,-1.8*k); g.lineTo(-0.6*k,-1.8*k); g.lineTo(-0.6*k,0.2*k); g.lineTo(-1.7*k,0.2*k); g.closePath(); return g; };
  const tilt=new THREE.Group(); tilt.rotation.x=Math.PI/2-0.75; tilt.scale.setScalar(0.95); arrow.add(tilt); // 箭嘴指向前，斜向鏡頭
  const body=new THREE.Mesh(new THREE.ExtrudeGeometry(sh(1),{depth:0.35,bevelEnabled:false}),M(0xff7a1a,{e:0x662200})); tilt.add(body);
  const rim=new THREE.Mesh(new THREE.ShapeGeometry(sh(1.18)),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide})); rim.position.z=0.175; tilt.add(rim);
  tilt.position.z=0.3; }

/* ---------- 轉彎路口：藍色霓虹「》」指示牌 ---------- */
const TURNS=(()=>{ const N=10, signs=[];
  const cv=document.createElement('canvas'); cv.width=256; cv.height=192; const g=cv.getContext('2d');
  g.fillStyle='#071426'; g.fillRect(0,0,256,192); g.strokeStyle='#1d6dff'; g.lineWidth=6; g.strokeRect(5,5,246,182);
  const chev=(x)=>{ g.beginPath(); g.moveTo(x,36); g.lineTo(x+52,96); g.lineTo(x,156); };
  g.lineCap='round'; g.lineJoin='round';
  [[30,'#2f7dff'],[14,'#7fb3ff'],[6,'#ffffff']].forEach(([w,c])=>{ g.strokeStyle=c; g.lineWidth=w; g.shadowColor='#3b8bff'; g.shadowBlur=w>20?28:10; chev(64); g.stroke(); chev(132); g.stroke(); });
  const tex=new THREE.CanvasTexture(cv); tex.anisotropy=4;
  const gc=document.createElement('canvas'); gc.width=gc.height=128; const gg=gc.getContext('2d'); const rg=gg.createRadialGradient(64,64,4,64,64,64); rg.addColorStop(0,'rgba(70,140,255,.9)'); rg.addColorStop(1,'rgba(70,140,255,0)'); gg.fillStyle=rg; gg.fillRect(0,0,128,128);
  const gtex=new THREE.CanvasTexture(gc);
  const flatG=new THREE.PlaneGeometry(3.6,2.7), boardG=new THREE.PlaneGeometry(2.2,1.65), glowG=new THREE.PlaneGeometry(4.4,3.4), postG=new THREE.CylinderGeometry(0.07,0.07,1.8,6);
  const postM=new THREE.MeshLambertMaterial({color:0x4a5260});
  for(let i=0;i<N;i++){ const grp=new THREE.Group(); const bm=new THREE.MeshBasicMaterial({map:tex,toneMapped:false,side:THREE.DoubleSide});
    const b=new THREE.Mesh(boardG,bm); b.position.y=2.6; grp.add(b);
    const gm=new THREE.MeshBasicMaterial({map:gtex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,opacity:0.7});
    const gl=new THREE.Mesh(glowG,gm); gl.position.set(0,2.6,-0.05); grp.add(gl);
    const p=new THREE.Mesh(postG,postM); p.position.y=0.9; grp.add(p);
    const fm=new THREE.MeshBasicMaterial({map:tex,toneMapped:false,transparent:true,opacity:0.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-8,polygonOffsetUnits:-8});
    const fl=new THREE.Mesh(flatG,fm); fl.rotation.x=-Math.PI/2; fl.position.y=0.34; fl.renderOrder=4; grp.add(fl);
    grp.visible=false; scene.add(grp); signs.push({grp,b,bm,gm,gl,p,fl,fm,k:0}); }
  let T=0;
  function update(){ signs.forEach(z=>z.grp.visible=false); if(!S.route||S.mode!=='drive'||S.gm==='chase'||S.gm==='free') return;
    const P=routeAhead(); if(!P||P.length<3) return; let used=0, dist=0, turns=0;
    for(let i=1;i<P.length-1&&turns<2;i++){ const A=P[i-1],B=P[i],C=P[i+1]; let ux=B[0]-A[0],uz=B[1]-A[1]; const lu=Math.hypot(ux,uz); dist+=lu; if(dist>190) break;
      let vx=C[0]-B[0],vz=C[1]-B[1]; const lv=Math.hypot(vx,vz); if(lu<3||lv<6) continue; ux/=lu; uz/=lu; vx/=lv; vz/=lv;
      const ang=Math.atan2(ux*vz-uz*vx, ux*vx+uz*vz); if(Math.abs(ang)<0.6) continue;
      { let J=false; for(let q=0;q<NODES.length;q++){ if(DEG[q]>=3&&Math.hypot(NODES[q][0]-B[0],NODES[q][1]-B[1])<(NW[q]||6)+9){ J=true; break; } } if(!J) continue; }   // 只喺路口轉彎先擺，彎路唔擺
      const left=(vx*uz+vz*(-ux))>0;   // 左邊法線 (uz,-ux)
      // 搵轉入嗰條街嘅對面路邊：沿住行車方向行，直到轉入方向 10 米嗰點唔再係馬路
      let d=3; while(d<34&&(cellAt(B[0]+ux*d+vx*10,B[1]+uz*d+vz*10)&1)) d+=1;
      const n=Math.max(3,Math.min(5,Math.round(Math.abs(ang)/0.4)+2)), flat=d>=34; d+=1.2;
      for(let k=0;k<n&&used<N;k++,used++){ const z=signs[used]; z.b.visible=z.gl.visible=z.p.visible=!flat; z.fl.visible=flat;
        if(!flat){ const off=1.5+k*2.1;   // 沿住轉入方向排喺對面路邊，面向駛近嘅救護車
          z.grp.position.set(B[0]+ux*d+vx*off,ELEV(B[0],B[1]),B[1]+uz*d+vz*off); z.grp.rotation.y=Math.atan2(-ux,-uz); z.b.scale.x=left?-1:1; }
        else { const off=3.5+k*4;   // 搵唔到路邊（多叉路口）：改喺轉入嗰條路面畫發光「》」
          z.grp.position.set(B[0]+vx*off,ELEV(B[0]+vx*off,B[1]+vz*off),B[1]+vz*off); z.grp.rotation.y=Math.atan2(-vz,vx); }
        z.k=k; z.n=n; z.grp.visible=true; }
      turns++; } }
  function tick(dt,t){ T+=dt; if(T>0.3){ T=0; update(); } signs.forEach(z=>{ if(!z.grp.visible) return; const ph=((t*3)%(z.n+1.5)); const on=Math.abs(ph-z.k)<0.9; const f=on?1:0.45; z.bm.color.setScalar(f); z.gm.opacity=on?0.9:0.35; z.fm.opacity=on?0.95:0.5; }); }
  function hide(){ signs.forEach(z=>z.grp.visible=false); }
  return {update,tick,hide}; })();
function setTarget(xz){ S.arrowA=null; S.target=xz; ring.position.set(xz[0],0.5,xz[1]); beacon.position.set(xz[0],20,xz[1]); ring.visible=beacon.visible=arrow.visible=true; S.routeT=0; }
// 路線點：車位 → 路口 … → 目的地（略過車已經行過嘅第一個路口、目的地之後嘅最後一個路口）
function onSeg(px,pz,A,B){ const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; const t=((px-A[0])*dx+(pz-A[1])*dz)/L2; const qx=A[0]+dx*t-px,qz=A[1]+dz*t-pz; return t>0&&t<1&&qx*qx+qz*qz<16*16; }
function refreshRoute(force){
  const c=S.car, T=S.target;
  const segCand=(x,z)=>{ const A=nearestNode(x,z); const out=[A]; ADJ[A].forEach(e=>{ if(onSeg(x,z,NODES[A],NODES[e[0]])) out.push(e[0]); }); return out; };
  // 起點：喺車後面嘅路口要掉頭，加罰分；終點：最後一段要令目的地喺左手邊（靠左行），否則加罰分
  const fx=Math.sin(c.a), fz=Math.cos(c.a); let best=null;
  // 未出救護站：先直駛出車房到馬路先計路線（唔好計條穿過車房嘅路）
  let sx=c.x, sz=c.z; if(!S.leftDepot&&S.step===1){ for(let d=4;d<60;d+=2){ const px=c.x+fx*d, pz=c.z+fz*d; if(cellAt(px,pz)&1){ sx=px+fx*3; sz=pz+fz*3; break; } } }
  const ends=segCand(T[0],T[1]), starts=segCand(sx,sz);
  const ban=CLOSED.map(r=>r.n); if(ends.length>1) ban.push(ends); if(starts.length>1) ban.push(starts); // 唔准喺起點／終點嗰段兜返轉頭
  for(const n of starts) for(const m of ends){ const r=route(n,m,ban); if(!r) continue;
    const N=NODES[n], E=NODES[m]; const dx=N[0]-sx, dz=N[1]-sz;
    const ex=T[0]-E[0], ez=T[1]-E[1], el=Math.hypot(ex,ez)||1; let side=1; { const o=ends.find(q=>q!==m); if(o!=null){ const O=NODES[o]; const [ux,uz]=dirn(E,O); side=ex*uz-ez*ux; } } // 正數 = 喺左手邊
    let cost=r.len+Math.hypot(dx,dz)+el+(dx*fx+dz*fz<-4?120:0)+(side<0?30:0);   // 救護車可以過對面線，唔使為咗靠左停而兜圈
    if(n===m&&starts.length>1&&ends.length>1&&starts.includes(ends[0])&&starts.includes(ends[1])) cost=Math.hypot(T[0]-c.x,T[1]-c.z)+((T[0]-c.x)*fx+(T[1]-c.z)*fz<0?400:0); // 同一段路
    if(!best||cost<best.cost) best={r,cost}; }
  { const dd=Math.hypot(T[0]-c.x,T[1]-c.z); let clear=dd<55; for(let k=0.05;clear&&k<1;k+=0.05) if(cellAt(c.x+(T[0]-c.x)*k,c.z+(T[1]-c.z)*k)&6) clear=false;   // 就到目的地：直接畫過去，唔再兜路
    if(clear&&(S.step!==1||S.leftDepot)){ const pts=[[c.x,c.z],T]; S.route={path:[],pts,len:dd,cum:[0,dd],idx:0}; drawRoute(pts); return; } }
  if(!best) return; const r=best.r; let path=r.path.slice();
  if(path.length>1&&onSeg(sx,sz,NODES[path[0]],NODES[path[1]])) path.shift();
  if(path.length>1&&onSeg(T[0],T[1],NODES[path[path.length-2]],NODES[path[path.length-1]])) path.pop();
  if(path.length===1&&onSeg(T[0],T[1],[c.x,c.z],NODES[path[0]])) path=[];
  const raw=[[c.x,c.z],...(sx!==c.x||sz!==c.z?[[sx,sz]]:[]),...path.map(i=>NODES[i]),T];
  // 靠左行（香港）：路口位置向左偏到行車線中間
  const lane=(p,q,i)=>{ const r=EDGE[path[i-2]+'-'+path[i-1]]; return r?laneOff(r):3.4; };
  const pts=[raw[0]];
  for(let i=1;i<raw.length-1;i++){ const p=raw[i], a=raw[i-1], q=raw[i+1];
    let d1=[p[0]-a[0],p[1]-a[1]], d2=[q[0]-p[0],q[1]-p[1]]; const l1=Math.hypot(...d1)||1, l2=Math.hypot(...d2)||1; d1=[d1[0]/l1,d1[1]/l1]; d2=[d2[0]/l2,d2[1]/l2];
    const n1=[d1[1],-d1[0]], n2=[d2[1],-d2[0]]; const o1=i>=2?lane(a,p,i):(i+1<raw.length-1?lane(p,q,i+1):3.4), o2=i+1<raw.length-1?lane(p,q,i+1):o1;
    const cr=d1[0]*d2[1]-d1[1]*d2[0], dot=d1[0]*d2[0]+d1[1]*d2[1];
    if(dot<-0.7){ pts.push([p[0]+n1[0]*o1,p[1]+n1[1]*o1]); pts.push([p[0]+n2[0]*o2,p[1]+n2[1]*o2]); }
    else if(Math.abs(cr)<0.08) pts.push([p[0]+(n1[0]*o1+n2[0]*o2)/2,p[1]+(n1[1]*o1+n2[1]*o2)/2]);
    else { // 兩條偏移線相交
      const P1=[p[0]+n1[0]*o1,p[1]+n1[1]*o1], P2=[p[0]+n2[0]*o2,p[1]+n2[1]*o2]; const tt=((P2[0]-P1[0])*d2[1]-(P2[1]-P1[1])*d2[0])/cr; pts.push([P1[0]+d1[0]*tt,P1[1]+d1[1]*tt]); } }
  pts.push(T);
  if(sx!==c.x||sz!==c.z) pts.splice(1,0,[sx,sz]);   // 直駛出車房先轉入行車線
  let len=0; for(let i=1;i<pts.length;i++) len+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  S.route={path:r.path,pts,len,cum,idx:0}; drawRoute(pts); if(NEON) NEON.rail.cutPath(pts);   // 路線要駛入車道／停車點：拆走擋路嘅欄杆
}
// 沿路線向前望 ahead 米，畀箭嘴指
// 車喺路線上嘅位置（只向前搵，唔會因為經過路口而跳返轉頭）
function routeProj(){ const c=S.car, R=S.route, P=R.pts; let best=null;
  for(let i=Math.max(1,R.idx);i<P.length&&i<R.idx+6;i++){ const A=P[i-1],B=P[i]; const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1;
    let t=((c.x-A[0])*dx+(c.z-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); const d=Math.hypot(A[0]+dx*t-c.x,A[1]+dz*t-c.z);
    if(!best||d<best.d-0.5) best={i,t,d,s:R.cum[i-1]+Math.sqrt(L2)*t}; }
  if(best) R.idx=best.i; return best; }
function pointAt(s){ const R=S.route, P=R.pts; s=Math.min(s,R.len); let i=1; while(i<P.length-1&&R.cum[i]<s) i++;
  const A=P[i-1],B=P[i], L=R.cum[i]-R.cum[i-1]||1, k=(s-R.cum[i-1])/L; return [A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k]; }
function lookAhead(ahead){ const pr=routeProj(); if(!pr) return S.target; return pointAt(pr.s+ahead); }
/* ---------- UI ---------- */
function show(id,on){ $(id).classList.toggle('show',on); }
function hud(title,sub){ $('hTitle').textContent=title; $('hSub').textContent=sub; }
function caption(txt){ const el=$('cap'); if(!txt){el.classList.remove('show');return;} el.textContent=txt; el.classList.add('show'); }
let toastT=0; function toast(txt){ const el=$('toast'); el.textContent=txt; el.classList.add('show'); toastT=2.2; }
/* ---------- 流程 ---------- */
function dropModel(m){ scene.remove(m); m.traverse(o=>{ if(o.geometry&&!o.geometry.userData.shared) o.geometry.dispose(); }); }
function resetActors(){ clearScene();
  cars.forEach(c=>dropModel(c.m)); cars.length=0; peds.forEach(p=>scene.remove(p.m)); peds.length=0;
  crew.visible=false; scene.attach(patient); patient.visible=false; bystander.visible=false;
  amb.userData.doors.forEach(d=>d.rotation.y=0); amb.visible=true;
}
function startCase(i){
  ensureAudio(); chModeExit(); S.gm='ems'; sirenSet(false);
  const lv=LEVELS[i]; S.lvl=i; S.level=lv; const k=caseOf(lv); S.kase=k; S.kase.loc=LMK[k.poi]; { const Lc=S.kase.loc; if(NEON&&Lc&&Lc.stop&&Lc.patient) NEON.rail.cutPath([Lc.stop,Lc.patient],3); } DEPOT=DEPOTS[lv.depot||(REGION==='st'?'st':'tm')]; AE=HOSPS[DEF_H]; S.dest=DEF_H; { const fx=Math.sin(DEPOT.a), fz=Math.cos(DEPOT.a); cam.position.set(DEPOT.pos[0]+fx*34,12,DEPOT.pos[1]+fz*34); camLook.set(DEPOT.pos[0],2,DEPOT.pos[1]); }   // 鏡頭即刻去返今關救護站，唔好由另一區飛過嚟
  resetActors(); setTOD(lv.tod); clearEvents();
  const d=DEPOT.pos;
  Object.assign(S.car,{x:d[0],z:d[1],a:DEPOT.a,v:0}); S.camYaw=S.car.a;
  Object.assign(S,{yieldPass:0,mode:'drive',step:1,leftDepot:false,depotCam:false,sirenMuted:false,swingT:0,wasBay:false,sirenUsed:false,equipOk:false,quizOk:false,lives:5,onTime:0,overT:false,stab:100,stabLow:100,dashLeft:lv.dash,dashT:14+Math.random()*10,newAch:[],log:[],pedLast:-9,collided:false,redRun:false,inX:-1,quizOpen:false,qDone:[false,false,!k.triage],qScore:0,qPending:0,collisions:0,t0:performance.now()/1000,tScene:0,tHosp:0,lastHit:-9,tut:false,yieldScore:0});
  PLAY.radioClear(); PLAY.tutEnd(); PLAY.evReset(); if(S.tutPick){ S.tutPick=false; PLAY.tutStart(); }
  S.noCross=!!(lv.support||lv.escort); const carN=S.noCross?Math.round(lv.cars*0.6):lv.cars;   // 有其他車一齊出動：冇行人過馬路、路面車少啲，提升效能
  S.spawnFree=true; // 開局一次過擺好（之後先避開鏡頭）
  for(let n=0;n<carN;n++){ const c={m:carModel(['taxi','car','bus','car','minibus','taxi','car'][n%7])}; if(placeCar(c,d[0],d[1])) cars.push(c); else dropModel(c.m); }
  for(let n=0;n<PED_N;n++){ const p={m:pedModel()}; if(placePed(p,d[0],d[1])) peds.push(p); else scene.remove(p.m); }
  S.spawnFree=false; setupScene(k,lv);
  const L=k.loc; patient.visible=true; patient.position.set(L.patient[0],0.3,L.patient[1]); patient.rotation.set(0,Math.random()*6,0);
  patient.userData.blanket.visible=false; patient.userData.p.position.set(0,0.5,1.2); patient.userData.p.rotation.set(-Math.PI/2,0,0);
  bystander.visible=true; bystander.position.set(L.patient[0]+2,0.2,L.patient[1]+1.5);
  setTarget(L.stop); refreshRoute(true); startLeg(); S.escRoute=S.route?{pts:S.route.pts.map(p=>p.slice()),cum:S.route.cum.slice(),len:S.route.len}:null; // 其他救護車跟住呢條橙色線
  caption(null); show('menu',false); show('result',false); show('over',false); show('quiz',false); show('hudWrap',true); drawLives(); realBegin(!!S.realPick);
  hud(lv.id.replace('L','第 ')+' 關 · '+k.place,'① 出車 · '+k.title+' · '+lv.todName); $('call').textContent='控制中心：'+k.call; show('callBox',true); setTimeout(()=>show('callBox',false),4200);
  alarm();
}
function arriveScene(){
  S.mode='seq'; S.seq=0; S.step=2; S.tScene=performance.now()/1000-S.t0; endLeg(); S.car.v=0; ring.visible=beacon.visible=arrow.visible=false;
  if(routeMesh) routeMesh.visible=false;

  hud('任務：'+S.kase.place,'② 到場 · 救護員處理'); PLAY.radio('A188'+' 到場 '+S.kase.place+'，救護員處理中。','A188');
}
function toHospital(){
  AE=HOSPS[S.dest]||HOSPS[DEF_H]; S.mode='drive'; S.step=4; clearEvents(); setTarget(AE.stop); refreshRoute(true); if(routeMesh) routeMesh.visible=true; S.stab=100; S.stabLow=100; show('stabBox',true); startLeg();
  hud('送院：'+AE.name+'急症室','④ 送院 · 跟住橙色路線'); caption(null); PLAY.radio('A188'+' 病人已上車，而家送去'+AE.name+'急症室。','A188'); setTimeout(()=>{ if(S.step===4&&S.mode==='drive') PLAY.radio('收到 '+'A188'+'，'+AE.name+'急症室已經準備好接收。'); },5200);
  // 重新分佈車同行人到新位置附近
  // 只搬鏡頭睇唔到嘅車同行人（其他會喺行遠咗之後先自然重新分佈）
  cars.forEach(c=>{ if(!c.pose||!inView(c.pose.x,c.pose.z)) placeCar(c,S.car.x,S.car.z); }); peds.forEach(p=>{ if(!p.pos||!inView(p.pos[0],p.pos[1],4)) placePed(p,S.car.x,S.car.z); });
}
function arriveHospital(){ PLAY.radio('A188'+' 到達'+(AE.name||'')+'急症室，準備交接病人。','A188'); sirenSet(false); S.mode='hseq'; S.seq=0; S.step=5; S.tHosp=performance.now()/1000-S.t0; endLeg(); show('stabBox',false); clearEvents(); S.car.v=0; ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false;
  hud(AE.name+'急症室','⑤ 交接病人'); }
function finish(){
  if(REAL.on&&S.gm==='ems'&&!REAL.ending){ realAVM(); return; }   // 寫實模式：交接完先 AVM 返站
  S.stars=S.lives; S.mode='result'; caption(null); sirenSet(false);
  const lv=S.level; if(!FUN.on){ saveBest(lv.id,S.stars); markDone(lv.id); }
  // 成就（歡樂模式唔計）
  if(!FUN.on){ ach('first'); if(S.lives===5) ach('perfect'); if(S.onTime>=2) ach('ontime'); if(S.stabLow>=85) ach('steady'); if(S.qScore>=2) ach('quiz');
  if(lv.tod==='night'||lv.tod==='rain') ach('night'); if(LEVELS.every(l=>isDone(l.id))) ach('all'); if(!S.redRun&&S.sirenUsed) ach('siren'); }
  $('rTitle').textContent=FUN.on?'🎉 歡樂模式完成（唔計成績）':'任務完成';
  $('rStars').innerHTML=[0,1,2,3,4].map(i=>'<span class="'+(i<S.stars?'on':'off')+'">'+lifeStar(34)+'</span>').join('');
  $('rTime').textContent='到場 '+fmt(S.tScene)+' · 送院完成 '+fmt(S.tHosp);
  const ex=[];
  ex.push((S.onTime>=2?'⏱️ 兩段都準時':'⏱️ 準時 '+S.onTime+' / 2 段'));
  ex.push('🛏️ 病人穩定度最低 '+Math.round(S.stabLow)+'%');
  ex.push('🧰 裝備 '+(S.equipOk?'揀啱':'揀錯')+' · 小測 '+(S.quizOk?'答啱':'答錯'));
  if(FUN.on) ex.push('🎉 歡樂分 '+FUN.score.toLocaleString());
  if(REAL.on) ex.push('🏅 今更完成 '+REAL.jobs+' 單 · 得分 '+REAL.shift.toLocaleString()+' · 累積總分 '+REAL.cash.toLocaleString());
  if(S.yieldPass) ex.push('🚑 順利越過讓路車 '+S.yieldPass+' 架'); if((S.yieldPass||0)>=5) ach('yield');
  $('rNote').innerHTML=(S.lives===5?'完美！全程冇犯錯。':'扣咗 '+(5-S.lives)+' 粒：'+S.log.join('、'))+'<br><small>'+ex.join(' · ')+'</small>';
  $('rAch').innerHTML=S.newAch.length?'<b>🏆 新成就：</b>'+S.newAch.map(a=>ACH[a].name).join('、'):'';
  const nx=LEVELS[S.lvl+1]; $('rNext').style.display=nx?'block':'none'; if(nx) $('rNext').textContent='下一關：'+caseOf(nx).place+'（'+nx.todName+'）';
  $('rTips').innerHTML='<b>📗 已收集知識卡：'+S.kase.title+'</b><ul>'+S.kase.tips.map(t=>'<li>'+t+'</li>').join('')+'</ul>';
  $('rName').value=getName(); $('rSave').disabled=false; $('rSave').textContent='儲存到排行榜';
  PLAY.chalResult(); if(S.tut){ store.set('tutDone',1); $('rTitle').textContent='🎓 新手教學完成！'; } PLAY.tutEnd(); S.tut=false;
  show('result',true); show('hudWrap',false); checkLiveryUnlock(); fireworks(S.stars);
}
/* ---------- 任務完成：按剩低幾多粒生命之星放煙花（5 粒最多，0 粒冇） ---------- */
let FW=null;
function fireworks(n){ const cv=$('fw'); if(FW){ cancelAnimationFrame(FW.raf); FW=null; } const g=cv.getContext('2d'); const W=cv.width=innerWidth*Math.min(2,devicePixelRatio||1), H=cv.height=innerHeight*Math.min(2,devicePixelRatio||1);
  g.clearRect(0,0,W,H); if(!n||n<1||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const total=[0,2,4,7,11,18][Math.min(5,n)], dur=1.2+total*0.32, cols=['#ff4d6d','#ffd166','#06d6a0','#4cc9f0','#f72585','#ffffff','#ff9f1c'];
  const shots=[...Array(total)].map((_,i)=>({t:i*(dur/total)*0.9+Math.random()*0.2,x:W*(0.15+Math.random()*0.7),y:H*(0.12+Math.random()*0.35),c:cols[Math.random()*cols.length|0],big:n===5&&i%4===0,done:false}));
  const parts=[]; const t0=performance.now(); FW={raf:0};
  const pop=()=>{ try{ ensureAudio(); if(!actx) return; const o=actx.createOscillator(), gg=actx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(380+Math.random()*200,actx.currentTime); o.frequency.exponentialRampToValueAtTime(90,actx.currentTime+0.25); gg.gain.value=0.025; gg.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.3); o.connect(gg); gg.connect(master); o.start(); o.stop(actx.currentTime+0.3); }catch(e){} };
  const step=()=>{ const t=(performance.now()-t0)/1000; g.globalCompositeOperation='source-over'; g.fillStyle='rgba(0,0,0,0)'; g.clearRect(0,0,W,H);
    shots.forEach(s=>{ if(!s.done&&t>=s.t){ s.done=true; pop(); const k=s.big?90:48, sp=(s.big?7:5)*(W/800+0.6);
      for(let i=0;i<k;i++){ const a=i/k*Math.PI*2+Math.random()*0.1, v=sp*(0.6+Math.random()*0.5); parts.push({x:s.x,y:s.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,c:Math.random()<0.2?'#ffffff':s.c,heart:s.big&&i%6===0}); } } });
    g.globalCompositeOperation='lighter';
    for(let i=parts.length-1;i>=0;i--){ const p=parts[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.06*(W/800+0.6); p.vx*=0.985; p.vy*=0.985; p.life-=0.012; if(p.life<=0){ parts.splice(i,1); continue; }
      g.globalAlpha=Math.max(0,p.life); g.fillStyle=p.c; if(p.heart){ g.font=(14*(W/800+0.6))+'px sans-serif'; g.fillText('✱',p.x,p.y); } else { g.beginPath(); g.arc(p.x,p.y,2.2*(W/800+0.6),0,7); g.fill(); } }
    g.globalAlpha=1; if(t<dur+3||parts.length) FW.raf=requestAnimationFrame(step); else g.clearRect(0,0,W,H); };
  FW.raf=requestAnimationFrame(step); }
function stopFireworks(){ if(FW){ cancelAnimationFrame(FW.raf); FW=null; } const cv=$('fw'); cv.getContext('2d').clearRect(0,0,cv.width,cv.height); }
/* ---------- 生命之星：做錯一樣扣一粒，扣晒就遊戲結束 ---------- */
function lifeStar(sz){ return '<svg class="lstar" viewBox="-12 -12 24 24" width="'+sz+'" height="'+sz+'" aria-hidden="true"><g fill="currentColor" stroke="#fff" stroke-width="1.3"><rect x="-3.2" y="-11" width="6.4" height="22" rx="1"/><rect x="-3.2" y="-11" width="6.4" height="22" rx="1" transform="rotate(60)"/><rect x="-3.2" y="-11" width="6.4" height="22" rx="1" transform="rotate(-60)"/></g><path d="M0-7V7" stroke="#fff" stroke-width="1.5"/><path d="M-1.6-4.5q3.2 1.3 0 2.6t0 2.6t0 2.6" fill="none" stroke="#fff" stroke-width="1"/></svg>'; }
function drawLives(lost){ $('lives').innerHTML=[0,1,2,3,4].map(i=>'<span class="'+(i<S.lives?'on':'off')+(i===lost?' lost':'')+'" style="animation-delay:'+(i*0.12)+'s">'+lifeStar(18)+'</span>').join(''); $('lives').setAttribute('aria-label','生命之星 '+S.lives+' / 5'); }
function loseLife(why,msg){ if(FUN.on) return; if(S.tut){ toast('教學提示：'+msg+'（教學模式唔扣生命之星）'); return; } if(S.gm&&S.gm!=='ems') return; if(S.lives<=0) return; S.lives--; S.log.push(why); drawLives(S.lives); toast(msg+'  −1 生命之星');
  const el=$('lives'); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  if(S.lives<=0) setTimeout(()=>gameOver(why),700); }
function gameOver(why){ if(S.mode==='result') return; S.mode='over'; S.car.v=0; sirenSet(false); show('quiz',false); S.quizOpen=false; S.sirenMuted=false;
  $('oWhy').textContent='最後一次犯錯：'+why+'。'; $('oStars').innerHTML=[0,1,2,3,4].map(()=>'<span class="off">'+lifeStar(34)+'</span>').join(''); show('over',true); show('hudWrap',false); }
const fmt=s=>{s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};

/* ---------- 輸入 ---------- */
function bindHold(id,key){ const b=$(id); const on=e=>{e.preventDefault();S.hold[key]=true;b.classList.add('on')}, off=()=>{S.hold[key]=false;b.classList.remove('on')};
  b.addEventListener('pointerdown',on); ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,off)); }
bindHold('bL','L'); bindHold('bR','R'); bindHold('bG','G'); bindHold('bB','B');
// 鍵盤：方向鍵或者 WASD（W 上＝油、A 左、S 下＝倒、D 右）；用 e.code，大楷、中文輸入法都照用
const KEYS={ArrowLeft:'L',ArrowRight:'R',ArrowUp:'G',ArrowDown:'B',KeyA:'L',KeyD:'R',KeyW:'G',KeyS:'B'};
const typing=e=>{ const t=e.target; return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable); };
addEventListener('keydown',e=>{ if(typing(e)) return; const k=KEYS[e.code]||KEYS[e.key]; if(k){ S.hold[k]=true; e.preventDefault(); } if(e.code==='KeyH'&&!e.repeat) $('bH').click(); });
addEventListener('keyup',e=>{ const k=KEYS[e.code]||KEYS[e.key]; if(k) S.hold[k]=false; });
addEventListener('blur',()=>{ S.hold.L=S.hold.R=S.hold.G=S.hold.B=false; });
// 滑鼠（或手指）拉動畫面旋轉鏡頭：左右拉轉方向、上下拉改高低；放手兩秒後慢慢轉返車後面
S.camDrag={yaw:0,pitch:0,on:false,x:0,y:0,t:0};
R.domElement.style.touchAction='none';
R.domElement.addEventListener('pointerdown',e=>{ const D=S.camDrag; D.on=true; D.x=e.clientX; D.y=e.clientY; D.id=e.pointerId; try{ R.domElement.setPointerCapture(e.pointerId); }catch(_){} R.domElement.style.cursor='grabbing'; });
R.domElement.addEventListener('pointermove',e=>{ const D=S.camDrag; if(!D.on||e.pointerId!==D.id) return; D.yaw-=(e.clientX-D.x)*0.008; D.pitch=Math.max(-0.5,Math.min(1,D.pitch+(e.clientY-D.y)*0.006)); D.x=e.clientX; D.y=e.clientY; D.t=performance.now(); });
['pointerup','pointercancel'].forEach(ev=>R.domElement.addEventListener(ev,e=>{ const D=S.camDrag; D.on=false; D.t=performance.now(); R.domElement.style.cursor='grab'; }));
R.domElement.style.cursor='grab';
function camDragTick(dt){ const D=S.camDrag; if(!D.on&&performance.now()-D.t>2000){ const k=Math.min(1,dt*2); D.yaw-=D.yaw*k; D.pitch-=D.pitch*k; } }
$('bH').addEventListener('click',()=>{ if(!VSPEC.siren){ horn(); return; } sirenSet(!S.siren); if(S.siren) S.sirenUsed=true; });
$('rAgain').onclick=()=>{ stopFireworks(); S.gm==='cpr'?startCPR(CP.mode,CP.breaths):S.gm==='taxi'?startTaxi():S.gm==='chase'?startChase():startCase(S.lvl); }; $('rNext').onclick=()=>{ stopFireworks(); startCase(S.lvl+1); }; $('rMenu').onclick=()=>{ stopFireworks(); show('result',false);toMenu();};
$('oAgain').onclick=()=>S.gm==='taxi'?startTaxi():S.gm==='chase'?startChase():startCase(S.lvl); $('oMenu').onclick=()=>{show('over',false);toMenu();};
$('bMenu').onclick=()=>{ sirenSet(false); toMenu(); };
function toMenu(){ KIT.visible=false; PLAY.radioClear(); PLAY.tutEnd(); S.tut=false; realBegin(false); S.realPick=false; chModeExit(); clearEvents(); setTOD('day'); show('stabBox',false); show('quiz',false); S.quizOpen=false; S.sirenMuted=false; S.mode='menu'; resetActors(); ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false; caption(null); show('hudWrap',false); renderMenu(); show('menu',true); }

/* ---------- 聲音：警號（撳一下開／關）、出車鐘聲 ---------- */
let actx=null, osc=null, gain=null, sirenTimer=null;
let master=null;
function ensureAudio(){ try{ if(!actx){ actx=new (window.AudioContext||window.webkitAudioContext)(); master=actx.createGain(); master.gain.value=1; master.connect(actx.destination);
      // iOS 解鎖：喺第一次撳嘅時候播一段無聲音訊
      const b=actx.createBuffer(1,1,22050), src=actx.createBufferSource(); src.buffer=b; src.connect(master); src.start(0); }
    if(actx.state!=='running') actx.resume(); initFx(); }catch(e){} }
// 每次撳畫面都確保聲音開咗（有啲瀏覽器會自動暫停音訊）
['pointerdown','touchend','click','keydown'].forEach(ev=>addEventListener(ev,()=>{ if(actx&&actx.state!=='running'){ try{ actx.resume(); }catch(e){} } },{passive:true}));
// 引擎聲（鋸齒波＋低通）同倒車嗶嗶聲，音量都細過警號（0.04）
let eng=null, rev=null;
function initFx(){ if(eng||!actx) return;
  const o=actx.createOscillator(), o2=actx.createOscillator(), f=actx.createBiquadFilter(), g=actx.createGain(); o.type='sawtooth'; o2.type='square'; o2.detune.value=-1200;
  f.type='lowpass'; f.frequency.value=420; g.gain.value=0; o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start(); eng={o,o2,f,g};
  const r=actx.createOscillator(), rg=actx.createGain(); r.type='square'; r.frequency.value=1150; rg.gain.value=0; r.connect(rg); rg.connect(master); r.start(); rev={o:r,g:rg}; }
function audioTick(t){ if(!eng) return; const c=S.car, now=actx.currentTime, driving=S.mode==='drive';
  const gas=driving&&S.hold.G&&!S.hold.B; const v=Math.abs(c.v);
  eng.o.frequency.setTargetAtTime(48+v*4.2,now,0.08); eng.o2.frequency.setTargetAtTime(48+v*4.2,now,0.08); eng.f.frequency.setTargetAtTime(300+v*22,now,0.1);
  eng.g.gain.setTargetAtTime(gas?0.03:(driving&&v>1?0.012:0),now,gas?0.05:0.25);
  const back=driving&&S.hold.B&&c.v<=0.5; const beep=back&&(t*2.4%1)<0.5;
  rev.g.gain.setTargetAtTime(beep?0.025:0,now,0.01); }
function horn(){ ensureAudio(); if(!actx) return; try{ [0,0.22].forEach(d=>{ [392,494].forEach(f=>{ const o=actx.createOscillator(), g=actx.createGain(); o.type='sawtooth'; o.frequency.value=f*(VSPEC.kind==='bus'?0.62:1); g.gain.value=0.02; o.connect(g); g.connect(master); o.start(actx.currentTime+d); o.stop(actx.currentTime+d+0.16); }); }); }catch(e){} }
function sirenSet(on){ if(on&&!VSPEC.siren) on=false; S.siren=on; $('bH').classList.toggle('siren',on); $('bH').setAttribute('aria-pressed',on);
  if(on){ ensureAudio(); if(!actx||osc) return; osc=actx.createOscillator(); gain=actx.createGain(); osc.type='triangle'; gain.gain.value=0.0001; osc.connect(gain); gain.connect(master); osc.start();
    gain.gain.exponentialRampToValueAtTime(S.sirenMuted?0.0001:0.04,actx.currentTime+0.05); let hi=true; const step=()=>{ if(osc){osc.frequency.setValueAtTime(hi?VSPEC.tone[0]:VSPEC.tone[1],actx.currentTime); hi=!hi;} }; step(); sirenTimer=setInterval(step,VSPEC.tone[2]); }
  else { clearInterval(sirenTimer); if(gain&&actx){ gain.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.08); const o=osc; setTimeout(()=>{try{o.stop()}catch(e){}},120);} osc=null; gain=null; } }
// 答問題時警號聲暫時靜音（閃燈同讓路照舊），答完自動回復
function sirenMute(m){ S.sirenMuted=m; if(!gain||!actx) return; try{ gain.gain.cancelScheduledValues(actx.currentTime); gain.gain.setTargetAtTime(m?0.0001:0.04,actx.currentTime,0.06); }catch(e){} }
function alarm(){ if(!actx) return; try{ for(let i=0;i<6;i++){ const o=actx.createOscillator(),g=actx.createGain(); o.type='square'; o.frequency.value=1200; g.gain.value=0.04;
  o.connect(g); g.connect(master); o.start(actx.currentTime+i*0.25); o.stop(actx.currentTime+i*0.25+0.12); } }catch(e){} }
document.addEventListener('visibilitychange',()=>{ try{ if(master) master.gain.setTargetAtTime(document.hidden?0:1,actx.currentTime,0.05); if(!document.hidden&&actx&&actx.state!=='running') actx.resume(); }catch(e){} if(document.hidden&&S.siren){ const was=true; sirenSet(false); S._resume=was; } else if(!document.hidden&&S._resume){ S._resume=false; if(S.mode==='drive') sirenSet(true); } });

/* ---------- 小地圖 ---------- */
const MM=document.createElement('canvas'); const MMS=0.35; MM.width=Math.ceil((BX1-BX0+120)*MMS); MM.height=Math.ceil((BZ1-BZ0+120)*MMS);
{ const g=MM.getContext('2d'); g.fillStyle='#eef2e8'; g.fillRect(0,0,MM.width,MM.height); const T=([x,z])=>[(x-BX0+60)*MMS,(z-BZ0+60)*MMS];
  g.fillStyle='#bfe6a8'; MAP.parks.forEach(p=>{g.beginPath();p.forEach((q,i)=>{const [a,b]=T(q);i?g.lineTo(a,b):g.moveTo(a,b)});g.fill();});
  g.fillStyle='#8fd0f2'; MAP.water.forEach(p=>{g.beginPath();p.forEach((q,i)=>{const [a,b]=T(q);i?g.lineTo(a,b):g.moveTo(a,b)});g.fill();});
  g.strokeStyle='#9aa1ad'; g.lineCap='round'; MAP.roads.forEach(r=>{ g.lineWidth=Math.max(1.5,r.w*MMS); g.beginPath(); r.n.forEach((i,k)=>{const [a,b]=T(NODES[i]); k?g.lineTo(a,b):g.moveTo(a,b)}); g.stroke(); });
  g.fillStyle='#d8dee6'; MAP.blds.forEach(b=>{ g.fillStyle=b.lm?'#ffb07a':'#d8dee6'; g.beginPath(); b.p.forEach((q,i)=>{const [a,c]=T(q);i?g.lineTo(a,c):g.moveTo(a,c)}); g.fill(); }); }
const mmc=$('mini'), mg=mmc.getContext('2d');
function drawMini(){
  const W=mmc.width, Hh=mmc.height, c=S.car, sc=2.0; mg.save(); mg.clearRect(0,0,W,Hh);
  mg.beginPath(); mg.arc(W/2,Hh/2,W/2-2,0,Math.PI*2); mg.clip(); mg.fillStyle='#eef2e8'; mg.fillRect(0,0,W,Hh);
  mg.translate(W/2,Hh/2); mg.rotate(Math.PI+c.a); mg.scale(sc,sc);
  mg.drawImage(MM,-(c.x-BX0+60)*MMS,-(c.z-BZ0+60)*MMS);
  if(S.route&&S.mode==='drive'){ const RP=routeAhead()||[]; mg.strokeStyle='#ff7a1a'; mg.lineWidth=3/sc; mg.lineJoin=mg.lineCap='round'; mg.beginPath(); mg.moveTo(0,0); RP.forEach((n,k)=>{ if(k) mg.lineTo((n[0]-c.x)*MMS,(n[1]-c.z)*MMS)}); mg.stroke(); }
  if(S.gm==='chase') CH.cops.forEach(p=>{ mg.fillStyle=(Math.floor(performance.now()/250)%2)?'#1f4fbf':'#e8323c'; mg.beginPath(); mg.arc((p.x-c.x)*MMS,(p.z-c.z)*MMS,5/sc,0,Math.PI*2); mg.fill(); });
  if(S.gm==='taxi') TX.wait.forEach(w=>{ mg.fillStyle=TX.cls[w.k].css; mg.beginPath(); mg.arc((w.s.p[0]-c.x)*MMS,(w.s.p[1]-c.z)*MMS,5/sc,0,Math.PI*2); mg.fill(); });
  if(S.target){ mg.fillStyle='#e8323c'; mg.beginPath(); mg.arc((S.target[0]-c.x)*MMS,(S.target[1]-c.z)*MMS,4/sc,0,Math.PI*2); mg.fill(); }
  mg.restore(); mg.fillStyle='#1f4fbf'; mg.beginPath(); mg.moveTo(W/2,Hh/2-8); mg.lineTo(W/2+6,Hh/2+6); mg.lineTo(W/2-6,Hh/2+6); mg.fill();
  mg.strokeStyle='#fff'; mg.lineWidth=3; mg.beginPath(); mg.arc(W/2,Hh/2,W/2-2,0,Math.PI*2); mg.stroke();
}

/* ---------- 碰撞 ---------- */
function ambCircles(x,z,a){ const ux=Math.sin(a),uz=Math.cos(a); return VSPEC.circ.map(o=>[x+ux*o,z+uz*o]); }
function hitBuilding(x,z,a){ const ux=Math.sin(a),uz=Math.cos(a), rx=uz, rz=-ux;
  // 喺高架路上面：下面嘅樓／河唔計（以前會變成空氣牆）；車身中間仲喺馬路上（例如過橋）：只計建築物，唔計橋邊嘅河
  if(ELEV(x,z)>2) return false; const mask=(cellAt(x,z)&1)?2:6;
  for(const o0 of [-3,-1,1,3]) for(const s0 of [-1.1,1.1]){ const o=o0*VSPEC.kl, s=s0*VSPEC.kw; if(cellAt(x+ux*o+rx*s,z+uz*o+rz*s)&mask) return true; } return false; }
function vib(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
function bump(why){ const now=performance.now()/1000; S.collided=true; if(REAL.on) REAL.stress+=12; if(now-(S.lastShake||0)>0.4){ S.lastShake=now; S.shake=0.45; vib(60); } if(now-S.lastHit>2.5){ S.collisions++; S.lastHit=now; loseLife(why,why+'！'); } }

/* ---------- 主迴圈 ---------- */
function clampCam(want,look){
  // 鏡頭同目標之間有建築物：拉近並升高，避免被樓宇遮住
  const dx=want.x-look.x, dz=want.z-look.z; let f=1;
  for(let k=0.08;k<=1.0;k+=0.04){ if(cellAt(look.x+dx*k,look.z+dz*k)&2){ f=k; break; } }
  if(f<1){ const k=Math.max(0.22,f-0.08); want.x=look.x+dx*k; want.z=look.z+dz*k; want.y=Math.max(want.y,44); }
  return want;
}

const clock=new THREE.Clock(); const camLook=new THREE.Vector3(); const lerp=(a,b,t)=>a+(b-a)*Math.min(1,Math.max(0,t));
function walk(g,t,on,ph=0){ const k=on&&!reduce?Math.sin(t*9+ph):0; g.userData.legL.rotation.x=k*0.5; g.userData.legR.rotation.x=-k*0.5; }
let FOV0=55; function resize(){ const w=innerWidth,h=innerHeight; R.setSize(w,h); cam.aspect=w/h; cam.fov=FOV0=w<h?64:52; cam.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();
/* 自動解像度：掉 frame 就逐步降低解像度，順返先升返；降咗之後陰影改為隔格更新 */
const DRES=(()=>{ const base=R.getPixelRatio(), min=Math.max(0.6,base*0.55); let r=base, n=0, t0=performance.now(), good=0;
  const apply=()=>{ R.setPixelRatio(r); if(REAL.comp&&REAL.comp.setPixelRatio) REAL.comp.setPixelRatio(r); R.shadowMap.autoUpdate=r>=base-0.01; };
  return { get atMin(){ return r<=min+0.01; }, get ratio(){ return r; }, tick(){ n++; if(!R.shadowMap.autoUpdate) R.shadowMap.needsUpdate=(n%2===0);
    const now=performance.now(); if(now-t0<1200) return; const fps=n*1000/(now-t0); n=0; t0=now; if(S.mode!=='drive'||document.hidden) return;
    if(fps<42&&r>min){ r=Math.max(min,r-0.12); good=0; apply(); } else if(fps>57){ if(++good>=3&&r<base){ r=Math.min(base,r+0.06); good=0; apply(); } } else good=0; } }; })();
const SGLOW=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); const rg=g.createRadialGradient(64,64,4,64,64,64); rg.addColorStop(0,'rgba(255,255,255,.9)'); rg.addColorStop(0.45,'rgba(255,255,255,.35)'); rg.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=rg; g.fillRect(0,0,128,128);
  const mat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,color:0x3a7bff,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(15,15),mat); m.rotation.x=-Math.PI/2; m.renderOrder=3; m.visible=false; scene.add(m);
  return { tick(lit,on,t){ m.visible=!!lit&&S.mode!=='menu'; if(!m.visible) return; const c=S.car; m.position.set(c.x+Math.sin(c.a)*-0.5,0.32+ELEV(c.x,c.z),c.z+Math.cos(c.a)*-0.5);
    mat.color.setHex(0x2f6bff); mat.opacity=(CARL.night?0.75:0.28)*(on?1:0.35); } }; })();   // 警號藍燈照地面（只有藍光，跟閃燈節奏）
function tick(){
  let dt=Math.min(0.05,clock.getDelta()); const t=clock.elapsedTime; const c=S.car, U=amb.userData; dt=funTime(dt);   // 歡樂模式慢鏡
  if(S.mode==='map'){ if(REAL.on) realRender(t); else R.render(scene,cam); requestAnimationFrame(tick); return; }   // 大地圖：暫停
  // 閃燈：出勤期間長開
  const on=Math.floor(t*5)%2===0, lit=S.siren; // 閃燈跟警號一齊開關
  CURL.forEach((b,i)=>b.material.emissive.setHex(lit&&((i%2===0)===on)?(b.userData.on||0x1550ff):0)); U.pB.intensity=lit&&on?1.4:0; U.pR.intensity=lit&&!on?1.4:0;
  if(FUN.on&&lit) CURL.forEach((b,i)=>{ if(b.material.emissive.getHex()) b.material.emissive.setHSL((t*0.9+i*0.17)%1,1,0.55); });   // 七彩警號燈
  // 煞車燈、轉向燈（跟轉彎方向閃）、警號紅藍光照落地面
  if(U.LT){ const H=S.hold, braking=S.mode==='drive'&&(H.B||(c.v>2&&!H.G)), st=S.mode==='drive'?(H.L?1:0)-(H.R?1:0):0, bl=Math.floor(t*3.2)%2===0;
    U.LT.tail.forEach(m=>m.material.emissive.setHex(braking?0xff2020:(CARL.night?0x6a0000:0x400000)));
    [-1,1].forEach(sd=>U.LT.ind[sd].forEach(m=>m.material.emissive.setHex(st===sd&&Math.abs(c.v)>0.5&&bl?0xffa000:0x402000))); }
  SGLOW.tick(lit,on,t);
  if(U.FL){ const n=!!CARL.night&&S.mode!=='menu'; if(U.FL.on!==n){ U.FL.on=n; U.FL.glow.forEach(q=>q.visible=n); U.FL.mat.emissive.setHex(n?0xffffff:0); } }   // 夜間白色照明射燈
  if(S.mode==='cpr') cprTick(dt,t);
  if(S.mode==='drive'&&S.gm==='free'&&FRE.onFoot) freeTick(dt,t); else if(S.mode==='drive'){
    const H=S.hold, steer=(H.L?1:0)-(H.R?1:0);
    const nitro=FUN.on&&S.hold.N, onRoad=(cellAt(c.x,c.z)&1)||FUN.on, vmax=(onRoad?(FUN.on?Math.max(VSPEC.vmax,38):VSPEC.vmax):12)*(nitro?1.6:1), AK=(FUN.on?Math.max(VSPEC.acc,1.35):VSPEC.acc)*(nitro?2.2:1);   // 歡樂模式：全車解放、上行人路唔減速、🚀 氮氣
    if(H.G&&!H.B) c.v=Math.min(vmax,c.v+(c.v<0?34:(c.v<12?26:17)*AK)*dt); else if(H.B&&!H.G) c.v=Math.max(-7,c.v-(c.v>0?34:14)*dt);
    else c.v=c.v>0?Math.max(0,c.v-(S.wet?9:14)*dt):Math.min(0,c.v+(S.wet?9:14)*dt);
    if(c.v>vmax) c.v=Math.max(vmax,c.v-20*dt);
    if(!FUN.on) aebTick(dt);
    c.a+=steer*dt*VSPEC.steer*(S.wet?0.82:1)*Math.min(1,Math.abs(c.v)/5+0.35)*(c.v<-0.1?-1:1); stabilityTick(dt,steer);
    const nx=c.x+Math.sin(c.a)*c.v*dt, nz=c.z+Math.cos(c.a)*c.v*dt;
    if(hitBuilding(nx,nz,c.a)){ if(Math.abs(c.v)>3){ bump('撞到建築物'); stabHit(14); } c.v=-c.v*0.25; } else { c.x=nx; c.z=nz; }
    // 同車碰撞
    const AC=ambCircles(c.x,c.z,c.a);
    for(const k of [...cars,...trams,...ESC]){ if(!k.pose) continue; const dx=k.pose.x-c.x, dz=k.pose.z-c.z; const half=(k.m.userData.len||4)/2; if(dx*dx+dz*dz>(half+6)**2) continue;
      const kx=Math.sin(k.pose.a), kz=Math.cos(k.pose.a);
      for(const q of AC){ const pr=Math.max(-half+1.3,Math.min(half-1.3,(q[0]-k.pose.x)*kx+(q[1]-k.pose.z)*kz)); const ex=k.pose.x+kx*pr-q[0], ez=k.pose.z+kz*pr-q[1]; if(ex*ex+ez*ez<3.0*3.0){ if(FUN.on&&cars.includes(k)&&funHitCar(k,c)) break; if(Math.abs(c.v)>2) bump('撞到車'); if(Math.abs(c.v)>2) stabHit(14); c.v=-c.v*0.3; const L=Math.hypot(ex,ez)||1; c.x-=ex/L*0.6; c.z-=ez/L*0.6; k.hit=1.5; k.yHit=true; break; } } }
    // 撞到行人 → 扣一粒心；同一個行人已經跌低咗就唔會再扣
    // 行人自動避開：救護車前面幾米有人就跳開（歡樂模式除外）
    if(DODGE.on&&!FUN.on&&Math.abs(c.v)>1.5){ const fx=Math.sin(c.a),fz=Math.cos(c.a),sg=Math.sign(c.v); for(const p of peds){ if(!p.pos||p.mode==='fly'||p.mode==='down'||p.mode==='jump') continue; const dx=p.pos[0]-c.x, dz=p.pos[1]-c.z, ah=(dx*fx+dz*fz)*sg, lat=dx*fz-dz*fx; if(ah>-1&&ah<VSPEC.kl*3.2+2+Math.abs(c.v)*0.3&&Math.abs(lat)<VSPEC.kw*1.3+1.2) pedDodge(p,c,lat); } }
    for(const p of peds){ if(!p.pos) continue; for(const q of AC){ const ex=p.pos[0]-q[0], ez=p.pos[1]-q[1]; if(ex*ex+ez*ez<1.7*1.7&&Math.abs(c.v)>1.2&&p.mode!=='fly'&&p.mode!=='down'&&p.mode!=='jump'){ if(FUN.on){ funHitPed(p,c); break; } if(DODGE.on){ pedDodge(p,c,(p.pos[0]-c.x)*Math.cos(c.a)-(p.pos[1]-c.z)*Math.sin(c.a)); break; } if(S.gm!=='ems'){ pedFly(p,c); break; } c.v=0; p.mode='down'; p.downT=2.5; p.m.rotation.set(-Math.PI/2,p.m.rotation.y,0); loseLife('撞到行人','不能傷害市民！'); break; } } if(S.mode!=='drive') break; }
    U.wheels.forEach(w=>w.rotation.x+=c.v*dt/0.6);
    // 過路口：冇開警號衝紅燈要扣分
    { let inX=-1; for(let kk=0;kk<NODES.length;kk++){ if(SIGNAL[kk]&&Math.hypot(NODES[kk][0]-c.x,NODES[kk][1]-c.z)<CLR[kk]-1.5){ inX=kk; break; } }
      if(inX>=0&&inX!==S.inX&&c.v>2){ const st=lightState(inX,c.a,t);
        if(st==='r'&&!S.siren){ S.redRun=true; loseLife('冇開警號衝紅燈','冇開警號衝紅燈！'); } else if(st==='r'&&S.siren) toast('開咗警號，小心慢駛過燈'); }
      S.inX=inX; }
    // 導航
    // 偏離路線先重新計（唔會每秒都重畫）
    S.routeT+=dt; S.routeDrawT=(S.routeDrawT||0)+dt; if(S.route&&S.routeDrawT>0.3&&routeMesh&&routeMesh.visible){ S.routeDrawT=0; drawRoute(routeAhead()); } if(S.gm!=='chase'&&S.gm!=='free'){ const pr=S.route&&routeProj(); if((pr&&pr.d>11&&S.routeT>0.4)||S.routeT>8||(S.routeT>1.2&&S.target&&S.route&&S.route.pts.length>2&&Math.hypot(S.target[0]-S.car.x,S.target[1]-S.car.z)<55)){ S.routeT=0; refreshRoute(); } }
    const d=Math.hypot(c.x-S.target[0],c.z-S.target[1]);
    $('hDist').textContent=d>1000?(d/1000).toFixed(1)+' 公里':Math.round(d)+' 米';
    if(S.gm==='ems'&&S.step!==6){ legTimer(); dashTick(dt); } else if(S.step===6) $('hTime').textContent='—';
    if(S.route){ const n=d<22?S.target:lookAhead(18); const want=Math.atan2(n[0]-c.x,n[1]-c.z);
      if(S.arrowA==null) S.arrowA=want; S.arrowA+=(((want-S.arrowA)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*7);
      arrow.position.set(c.x,7.8+ELEV(c.x,c.z)+Math.sin(t*4)*0.25,c.z); arrow.rotation.y=S.arrowA; }
    if(S.gm==='taxi') taxiTick(dt,d); else if(S.gm==='chase') chaseTick(dt); else if(S.gm==='free') freeTick(dt,t); else if(d<7.5){ S.step===1?arriveScene():S.step===6?realAtDepot():arriveHospital(); }
  }
  groundPose(amb,c.x,0.12,c.z,c.a,VSPEC.kl*6);
  ring.scale.setScalar(1+Math.sin(t*4)*0.06);
  /* --- 交通 --- */
  const SV=[]; if(S.siren&&S.mode==='drive') SV.push({x:c.x,z:c.z}); if(S.gm==='chase') CH.cops.forEach(p=>SV.push({x:p.x,z:p.z})); ESC.forEach(e=>{ if(e.pose&&e.m.visible&&!e.done) SV.push({x:e.pose.x,z:e.pose.z}); }); window.__SV=SV;
  const ALLV=cars.concat(trams,ESC);   // 每格只砌一次（之前每架車都砌一次）
  for(const k of cars){
    if(k.fly){ funCarTick(k,dt); continue; }   // 歡樂模式：彈飛緊
    if(!k.road) continue;
    let pose=carPose(k);
    if(k.stuck){ k.pose=pose; groundPose(k.m,pose.x,0.1,pose.z,pose.a,k.m.userData.len); if(k.haz) k.haz.forEach(h=>h.visible=Math.floor(t*3)%2===0); continue; }
    const dx=pose.x-c.x, dz=pose.z-c.z, dd=Math.hypot(dx,dz);
    if(k.waitEnd){ k.pose=pose; if(!inView(pose.x,pose.z)&&placeCar(k,c.x,c.z)) k.waitEnd=false; else { groundPose(k.m,pose.x,0.1,pose.z,pose.a,k.m.userData.len); continue; } pose=carPose(k); }
    if((dd>230||k.evict)&&!inView(pose.x,pose.z)&&S.mode==='drive'){ if(placeCar(k,c.x,c.z)){ k.evict=false; pose=carPose(k); k.cur=k.v; } }
    // 前面有救護車就停；開警號時靠邊減速讓路
    const fx=Math.sin(pose.a), fz=Math.cos(pose.a); const ahead=(-dx)*fx+(-dz)*fz, lat=Math.abs((-dx)*fz-(-dz)*fx);
    let target=k.v0||(k.v0=k.v);
    // 讓救護車：附近有響警號嘅救護車（玩家或者其他救護車）就靠邊減速；未入路口就喺停車線前等
    if(k.stubborn>0){ k.stubborn-=dt; if(k.stubborn<=0&&S.mode==='drive') toast('私家車終於讓路'); }   // 突發：唔留意警號嘅私家車
    for(const sv of SV){ const d2=Math.hypot(pose.x-sv.x,pose.z-sv.z); if(d2<55&&!(k.stubborn>0)) k.yield=2.5;
      if(SIGNAL[k.to]||DEG[k.to]>=3){ const N=NODES[k.to], rem=(1-k.t)*pose.L, sd=CLR[k.to]+4.6; if(rem>sd-1&&rem<sd+16&&Math.hypot(N[0]-sv.x,N[1]-sv.z)<50) target=Math.min(target,Math.max(0,(rem-sd)*0.9)); } }
    // 讓路：一邊向前行一邊靠左埋石壆，埋到邊就停低，開死火燈（前後四盞黃燈閃）
    if(k.yield>0){ k.yield-=dt; const want=k.road.w/2-(k.m.userData.len?1.9:1.5); const atKerb=Math.abs((k.off??0)-want)<0.3;
      target=Math.min(target,atKerb?0:4.5); yieldHaz(k,true,t); } else if(k.yh&&k.yh.on) yieldHaz(k,false,t);
    if(ahead>0&&ahead<14&&lat<3.5) target=0;
    // 紅綠燈：喺停車線前停
    if(SIGNAL[k.to]){ const stopD=CLR[k.to]+4.6;
      const rem=(1-k.t)*pose.L, st=lightState(k.to,pose.a,t); if(st!=='g'&&rem>stopD-0.8&&rem<stopD+18&&!(st==='y'&&rem<stopD+4)) target=Math.min(target,Math.max(0,(rem-stopD)*0.9)); }
    // 防重疊：前面路徑上（任何方向）有車／輕鐵就停低等；兩架互相擋住就號碼細嗰架先行
    k.id=k.id??cars.indexOf(k); let blocker=null;
    if(dd<180||inView(pose.x,pose.z)) for(const o of ALLV){ if(o===k||!o.pose) continue;   // 遠處睇唔到嘅車唔使計碰撞排隊
      const ex=o.pose.x-pose.x, ez=o.pose.z-pose.z; if(ex*ex+ez*ez>900) continue;
      const oL=(o.m.userData.len||4.4)/2+0.6, oW=(o.m.userData.len?1.4:1.2)+1.25, sa=Math.sin(o.pose.a), ca=Math.cos(o.pose.a), myL=(k.m.userData.len||4.4)/2;
      for(let q=myL;q<=myL+6;q+=1.5){ const px=pose.x+fx*q-o.pose.x, pz=pose.z+fz*q-o.pose.z; const al=px*sa+pz*ca, ac=px*ca-pz*sa;
        if(Math.abs(al)<oL&&Math.abs(ac)<oW){ blocker=o; break; } } if(blocker) break; }
    if(blocker&&!(blocker.blockedBy===k&&k.id<(blocker.id??99))) target=0;
    k.blockedBy=blocker;
    // 跟車：同方向前面有車就減速排隊
    const myLen=(k.m.userData.len||4.4)/2;
    for(const o of cars){ if(o===k||!o.pose) continue; const ex=o.pose.x-pose.x, ez=o.pose.z-pose.z; const ah=ex*fx+ez*fz; if(ah<=0||ah>26) continue;
      if(Math.abs(ex*fz-ez*fx)>2.2||Math.cos(o.pose.a-pose.a)<0.6) continue; const gap=ah-myLen-(o.m.userData.len||4.4)/2-2.2; target=Math.min(target,Math.max(0,gap*1.1)); }
    for(const p of peds){ if(p.mode!=='cross'||!p.pos||!p.onRoad) continue; const ex=p.pos[0]-pose.x, ez=p.pos[1]-pose.z; const ah=ex*fx+ez*fz; if(ah>0&&ah<12&&Math.abs(ex*fz-ez*fx)<3){ target=0; break; } }
    if(k.hit>0){ k.hit-=dt; target=0; }
    carLights(k.m,target<(k.cur??0)-0.4||(k.cur??0)<0.4);   // 剎車／停車：尾燈著
    // 讓路獎勵：響警號越過一架正在讓路嘅車，冇撞到佢
    if(k.yield>0&&S.siren&&S.mode==='drive'){ const pfx=Math.sin(c.a), pfz=Math.cos(c.a), rel=(pose.x-c.x)*pfx+(pose.z-c.z)*pfz, side=Math.abs((pose.x-c.x)*pfz-(pose.z-c.z)*pfx), half=(k.m.userData.len||4.4)/2;
      if(rel>half+1) k.yAhead=true; else if(k.yAhead&&rel<-half-1.5){ k.yAhead=false; if(!k.yHit&&side<9&&c.v>3){ S.yieldPass=(S.yieldPass||0)+1; } k.yHit=false; } }
    else { k.yAhead=false; k.yHit=false; }
    k.cur=(k.cur??target)+(target-(k.cur??target))*Math.min(1,dt*2);
    k.t+=k.cur*dt/(pose.L||1); if(k.t>=1){ nextEdge(k); }
    pose=carPose(k); k.pose=pose; groundPose(k.m,pose.x,0.1,pose.z,pose.a,k.m.userData.len);
    const da=((pose.a-k.m.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI; k.m.rotation.y+=da*Math.min(1,dt*6);
  }
  tramTick(dt); rainTick(dt); escortTick(dt,t); audioTick(t); updFrustum(); S.lightT=(S.lightT||0)+dt; if(S.lightT>0.25){ S.lightT=0; updateLights(t); }
  /* --- 行人 --- */
  if(FUN.on&&(!S.gm||S.gm==='ems')) pedFlyTick(dt);
  for(const p of peds){
    if(p.mode==='fly') continue;
    if(p.mode==='jump'){ const J=p.jmp; J.t+=dt/0.55; const k=Math.min(1,J.t); p.pos=[J.x0+(J.x1-J.x0)*k,J.z0+(J.z1-J.z0)*k]; p.m.position.set(p.pos[0],0.15+Math.sin(k*Math.PI)*1.3,p.pos[1]); p.m.rotation.set(0,J.ry,J.side*Math.sin(k*Math.PI)*0.6); walk(p.m,t,true,J.t*6);
      if(k>=1){ p.mode='idle'; p.m.rotation.set(0,J.ry+Math.PI,0); } continue; }
    if(p.mode==='down'&&p.downT!=null){ p.downT-=dt; if(p.downT<0){ p.downT=null; p.m.visible=false; p.m.rotation.set(0,0,0); if(placePed(p,c.x,c.z)) p.m.visible=true; else p.mode='down'; } }   // 瞓一陣之後消失
    if(p.mode==='down'&&!p.m.visible&&p.downT==null){ p.m.rotation.set(0,0,0); if(placePed(p,c.x,c.z)) p.m.visible=true; continue; }
    if(p.mode==='down'||p.mode==='idle'){ walk(p.m,t,false); if(!inView(p.pos[0],p.pos[1],4)&&Math.hypot(p.pos[0]-c.x,p.pos[1]-c.z)>40){ p.m.rotation.set(0,0,0); placePed(p,c.x,c.z); } p.m.position.set(p.pos[0],p.mode==='down'?0.5:0.15,p.pos[1]); continue; }
    if(p.mode==='dash'){ p.s+=3.4*dt; walk(p.m,t,true,p.s*3); p.pos=[p.x0+p.nx*p.s,p.z0+p.nz*p.s]; p.m.rotation.y=Math.atan2(p.nx,p.nz); if(p.s>p.len){ p.mode='idle'; } p.m.position.set(p.pos[0],0.15,p.pos[1]); continue; }
    if(p.mode==='walk'){ p.s+=p.dir*1.3*dt; if(p.s<p.lo||p.s>p.hi){p.dir*=-1; p.s=Math.max(p.lo,Math.min(p.hi,p.s));}
      const ux=(p.B[0]-p.A[0])/p.L, uz=(p.B[1]-p.A[1])/p.L; p.pos=[p.A[0]+ux*p.s+uz*p.off, p.A[1]+uz*p.s-ux*p.off];
      p.m.rotation.y=Math.atan2(ux*p.dir,uz*p.dir); walk(p.m,t,true,p.s); }
    else { // 過馬路：救護車響號接近時唔開始過
      const near=Math.hypot(p.cx-c.x,p.cz-c.z);
      if(p.wait>0){ p.wait-=dt; walk(p.m,t,false); if(S.siren&&near<40) p.wait=Math.max(p.wait,1); }
      else if(Math.abs(p.s)>=p.half-0.01&&p.node!=null&&lightState(p.node,p.ang,t)!=='r'){ walk(p.m,t,false); } // 等綠公仔（即係車行嘅方向紅燈）
      else { p.s+=p.dir*1.3*dt; walk(p.m,t,true,p.s); if(Math.abs(p.s)>p.half){ p.s=Math.sign(p.s)*p.half; p.dir*=-1; p.wait=2+Math.random()*5; } }
      p.pos=[p.cx+p.nx*p.s, p.cz+p.nz*p.s]; p.onRoad=Math.abs(p.s)<p.half-2.4; p.m.rotation.y=Math.atan2(p.nx*p.dir,p.nz*p.dir);
      if(Math.hypot(p.cx-c.x,p.cz-c.z)>220&&S.mode==='drive'&&!inView(p.pos[0],p.pos[1],4)) placePed(p,c.x,c.z); }
    if(p.mode==='walk'&&Math.hypot(p.pos[0]-c.x,p.pos[1]-c.z)>220&&S.mode==='drive'&&!inView(p.pos[0],p.pos[1],4)) placePed(p,c.x,c.z);
    p.m.position.set(p.pos[0],0.15,p.pos[1]);
  }
  ANI.tick(dt,t);   // 城市動物
  funTick(dt,t); realTick(dt);
  if(NEON) NEON.tick(t); busWaitTick(dt); TURNS.tick(dt,t); PLAY.tutTick(dt); PLAY.evTick(dt); HELP.tick(dt,t);
  gfxWatch(dt);
  /* --- 到場／醫院動畫 --- */
  if(S.mode==='seq'||S.mode==='hseq') sequence(dt,t);
  bystander.userData.arms[1].rotation.x=-2.6+Math.sin(t*8)*0.4;
  /* --- 鏡頭 --- */
  const portrait=innerWidth<innerHeight;
  let inDepot=S.mode==='drive'&&S.step===1&&!S.leftDepot&&!S.depotCam&&Math.hypot(c.x-DEPOT.pos[0],c.z-DEPOT.pos[1])<24;
  if(inDepot&&(S.hold.G||S.hold.R||Math.abs(c.v)>0.5)){ // 一踩油：鏡頭由門口喺車側繞半圈去車尾（大約 1 秒），之後一直跟車
    S.depotCam=true; inDepot=false; S.swingT=1.6; S.camYaw=Math.atan2(c.x-cam.position.x,c.z-cam.position.z); }
  if(inDepot){ // 開波：鏡頭喺救護站門口，影住救護車由車房駛出嚟
    const fx=Math.sin(DEPOT.a), fz=Math.cos(DEPOT.a); S.camYaw=c.a;
    cam.position.lerp(new THREE.Vector3(DEPOT.pos[0]+fx*34,12,DEPOT.pos[1]+fz*34),Math.min(1,dt*3)); // 正對車房門口，避開招牌同牆
    camLook.lerp(new THREE.Vector3(c.x,2,c.z),Math.min(1,dt*6));
    if(!S.hold.G&&c.v<0.5) caption(VSPEC.siren?'按住「油」出車；撳「警號」開閃燈同警號':'按住「油」出車；呢款車冇警號，其他車唔會讓路，要守交通燈'); else caption(null);
  } else if(S.mode==='drive'||S.mode==='over'){
    if(S.step===1&&S.leftDepot!==true){ S.leftDepot=true; caption(null); if(S.gm==='ems') PLAY.radio('A188 收到，出車前往'+S.kase.place+'。','A188'); if(S.level&&S.level.escort) launchEscorts(S.level.escort); if(S.level&&S.level.support) queueSupport(S.level.support); }
    // 車仲喺車房入面：鏡頭最多繞到車側，留喺門口外面同低位，唔會俾車房屋頂同牆遮住；車尾出咗門先繞埋去車後
    const DP=DEPOT.pos, hx=Math.sin(DEPOT.a), hz=Math.cos(DEPOT.a), sC=(c.x-DP[0])*hx+(c.z-DP[1])*hz, latC=(c.x-DP[0])*hz-(c.z-DP[1])*hx;
    const inBay=S.depotCam&&S.step===1&&sC>-12&&sC<16&&Math.abs(latC)<12, prog=Math.max(0,Math.min(1,sC/16));
    if(S.wasBay&&!inBay) S.swingT=1.6; S.wasBay=inBay;
    const dYaw=((c.a-S.camYaw+Math.PI*3)%(Math.PI*2)-Math.PI);
    if(inBay){ const sg=Math.sign(-dYaw)||1; S.camYaw=c.a+sg*Math.max(Math.PI*(1-prog),Math.abs(dYaw)-3.4*dt); }   // 車行得越出，鏡頭繞得越後
    else if(S.swingT>0){ S.swingT-=dt; const st=3.4*dt; S.camYaw+=Math.abs(dYaw)<=st?dYaw:Math.sign(dYaw)*st; if(Math.abs(dYaw)<0.05) S.swingT=0; }
    else S.camYaw+=dYaw*Math.min(1,dt*4.5);
    camDragTick(dt); const D=S.camDrag, yaw=S.camYaw+D.yaw;
    S.hwK=(S.hwK||0)+(((ANI.hw()&&S.leftDepot&&!(S.gm==='free'&&FRE.onFoot))?1:0)-(S.hwK||0))*Math.min(1,dt*1.2); const hk=S.hwK;   // 高速公路鏡頭：低啲、望遠啲，見到天空
    const rk=REAL.on?1:0, fs=(S.gm==='free'&&FRE.onFoot)?0.5:1, back=(portrait?19:16)*fs*(1-D.pitch*0.25)*(rk?0.8:1), up=(portrait?14:10.5)*fs*(1+D.pitch)*(1-0.42*hk)*(rk?0.48:1);   // 寫實模式：低鏡頭、貼車
    const eh=ELEV(c.x,c.z);
    if(inBay){ const R=16+(back-16)*prog, W=new THREE.Vector3(c.x-Math.sin(yaw)*R,5.5+(up-5.5)*prog,c.z-Math.cos(yaw)*R); const sw=(W.x-DP[0])*hx+(W.z-DP[1])*hz;
      if(sw<9.5){ W.x+=hx*(9.5-sw); W.z+=hz*(9.5-sw); W.y=Math.max(W.y,10); }   // 鏡頭唔入車房：最多退到門口上方
      cam.position.lerp(W,Math.min(1,dt*8)); camLook.lerp(new THREE.Vector3(c.x+Math.sin(c.a)*6*prog,1.6,c.z+Math.cos(c.a)*6*prog),Math.min(1,dt*9)); }
    else { const nearDepot=S.depotCam&&S.step===1&&sC>-12&&sC<45&&Math.abs(latC)<30; /* 只計救護站門前，唔計站後面條路 */ const CW=new THREE.Vector3(c.x-Math.sin(yaw)*back,up+eh,c.z-Math.cos(yaw)*back); if(nearDepot){ const sw=(CW.x-DP[0])*hx+(CW.z-DP[1])*hz; if(sw<9.5){ CW.x+=hx*(9.5-sw); CW.z+=hz*(9.5-sw); } } cam.position.lerp(nearDepot?CW:clampCam(CW,new THREE.Vector3(c.x,0,c.z)),Math.min(1,dt*(D.on||S.swingT>0?12:6)));
    camLook.lerp(new THREE.Vector3(c.x+Math.sin(yaw)*(6+34*hk+(REAL.on?10:0)),1.5+4*hk+eh+(REAL.on?1.4:0),c.z+Math.cos(yaw)*(6+34*hk+(REAL.on?10:0))),Math.min(1,dt*9)); }
  } else if(S.mode==='seq'||S.mode==='hseq'||S.mode==='result'){
    const P=S.mode==='hseq'?AE.door:(S.kase.loc?S.kase.loc.patient:[c.x+Math.sin(c.a)*8,c.z+Math.cos(c.a)*8]); const rear=[c.x-Math.sin(c.a)*4,c.z-Math.cos(c.a)*4];
    const mx=(rear[0]+P[0])/2, mz=(rear[1]+P[1])/2; let dx=mx-P[0], dz=mz-P[1]; const L=Math.hypot(dx,dz)||1; dx/=L; dz/=L;
    const want=new THREE.Vector3(mx+dx*(portrait?11:10),portrait?34:26,mz+dz*(portrait?11:10));
    cam.position.lerp(clampCam(want,new THREE.Vector3(mx,0,mz)),Math.min(1,dt*1.5)); camLook.lerp(new THREE.Vector3(mx,1,mz),Math.min(1,dt*2));
  } else if(S.mode==='cpr'){ cprCam(dt,t);
  } else { // 主選單：喺救護站上空慢慢轉
    const d=DEPOT.pos; const a=t*0.08; cam.position.set(d[0]+Math.sin(a)*80,55,d[1]+Math.cos(a)*80); camLook.set(d[0],0,d[1]);
    amb.position.set(d[0],0.12,d[1]); amb.rotation.y=DEPOT.a; }
  cam.lookAt(camLook);
  sun.position.set(cam.position.x+30,60,cam.position.z+20); sun.target.position.set(camLook.x,0,camLook.z);
  if(toastT>0){ toastT-=dt; if(toastT<=0) $('toast').classList.remove('show'); }
  if(S.mode==='drive') drawMini();
  { const px=cam.position.x, pz=cam.position.z; for(const q of INSTC){ const d=Math.hypot(q.c.x-px,q.c.z-pz)-q.r; q.m.visible=d<q.far; } }   // 遠嘅樹同街燈唔畫
  if((S.pkT=(S.pkT||0)+1)%15===0){ const px=cam.position.x, pz=cam.position.z; for(const c of PARKM){ const dx=c.position.x-px, dz=c.position.z-pz; c.visible=dx*dx+dz*dz<28900; } }
  // 速度感：揸快時視野變闊、畫面邊有速度線；撞車時鏡頭震一震
  { const sp=S.mode==='drive'?Math.abs(S.car.v)/Math.max(10,VSPEC.vmax):0, red=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const want=(REAL.on?Math.min(FOV0,58):FOV0)+(red?0:sp*sp*12); if(Math.abs(cam.fov-want)>0.05){ cam.fov+=(want-cam.fov)*Math.min(1,dt*3); cam.updateProjectionMatrix(); }
    const so=red?0:Math.max(0,(sp-0.62)/0.38); const fx=$('speedfx'); if(fx){ fx.style.opacity=(so*0.75).toFixed(2); if(so>0) fx.style.transform='rotate('+((t*37)%3)+'deg) scale(1.15)'; }
    if(S.shake>0&&!red){ S.shake=Math.max(0,S.shake-dt); const k=S.shake*1.6; cam.position.x+=(Math.random()-0.5)*k; cam.position.y+=(Math.random()-0.5)*k; } }
  DRES.tick(); if(REAL.on) realRender(t); else R.render(scene,cam); requestAnimationFrame(tick);
}
/* ---------- 到場：揀裝備、急救小測（各一題，錯就扣一粒） ---------- */
function openChoice(kind){ S.quizOpen=true; sirenMute(true); S.qKind=kind; caption(null); const Q=kind==='equip'?S.kase.equip:kind==='triage'?S.kase.triage:S.kase.quiz[0]; const n=Q.o.length;
  const order=[...Array(n).keys()].sort(()=>Math.random()-0.5);
  $('qNum').textContent=kind==='equip'?'🧰 到場揀裝備':kind==='triage'?'🏥 分流：送邊間醫院？':'📝 急救小測'; $('qText').textContent=Q.q; $('qWhy').textContent=''; $('qNext').style.display='none';
  $('qOpts').innerHTML=order.map(i=>'<button class="qo" data-i="'+i+'"></button>').join('');
  $('qOpts').querySelectorAll('.qo').forEach(b=>{ b.textContent=Q.o[+b.dataset.i]; b.onclick=()=>{ if($('qNext').style.display!=='none') return; const ok=+b.dataset.i===0;
    if(ok) S.qScore++; else S.qPending=1; if(kind==='equip') S.equipOk=ok; else if(kind==='triage'){ S.triageOk=ok; S.dest=Q.dest[0]; } else S.quizOk=ok;
    $('qOpts').querySelectorAll('.qo').forEach(x=>{ x.disabled=true; if(+x.dataset.i===0) x.classList.add('ok'); else if(x===b) x.classList.add('bad'); });
    $('qWhy').innerHTML='<b>'+(ok?'答啱！':(kind==='equip'?'揀錯裝備，扣 1 粒生命之星。':kind==='triage'?'分流揀錯醫院，扣 1 粒生命之星，改送正確醫院。':'答錯咗，扣 1 粒生命之星。'))+'</b> '; $('qWhy').append(Q.why); $('qNext').style.display='block'; $('qNext').focus(); }; });
  show('quiz',true); }
$('qNext').onclick=()=>{ show('quiz',false); const k=S.qKind==='equip'?0:S.qKind==='triage'?2:1; S.qDone[k]=true; S.quizOpen=false; sirenMute(false);
  if(S.qPending){ S.qPending=0; const why=['揀錯裝備','急救小測答錯','分流揀錯醫院'][k]; loseLife(why,why); } };

/* ---------- 動畫序列 ---------- */
function sequence(dt,t){
  if(S.quizOpen){ walk(crew.userData.c1,t,false); walk(crew.userData.c2,t,false); return; }
  S.seq+=dt;
  if(S.mode==='seq'&&S.seq>=3.2){ if(!S.qDone[0]){ S.seq=3.2; openChoice('equip'); return; } if(!S.qDone[1]){ S.seq=3.2; openChoice('quiz'); return; } if(!S.qDone[2]){ S.seq=3.2; openChoice('triage'); return; } }
  const s=S.seq, c=S.car, U=amb.userData, C1=crew.userData;
  const rear=new THREE.Vector3(c.x-Math.sin(c.a)*4.8,0.12,c.z-Math.cos(c.a)*4.8), inside=new THREE.Vector3(c.x-Math.sin(c.a)*1.2,0.55,c.z-Math.cos(c.a)*1.2);
  const kneel=(on)=>{ C1.c1.position.y=on?-0.38:0; C1.c2.position.y=on?-0.3:0; };
  const doorA=s<0.8?s/0.8:1; const close=S.mode==='seq'?(s>9.6?Math.min(1,(s-9.6)/0.6):0):(s>8?Math.min(1,(s-8)/0.6):0);
  U.doors.forEach(d=>d.rotation.y=-d.userData.s*1.65*doorA*(1-close));
  const look=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
  if(S.mode==='seq'){
    const P=new THREE.Vector3(S.kase.loc.patient[0]+1.4,0.15,S.kase.loc.patient[1]);
    const st=S.kase.steps;
    if(s<0.8){ KIT.visible=false; kneel(false); crew.visible=s>0.25; if(crew.visible){ const k=Math.min(1,(s-0.25)/0.55); crew.position.lerpVectors(inside,rear,k); crew.rotation.y=look(rear,inside); walk(C1.c1,t,true); walk(C1.c2,t,true,1); } caption('救護員落車，攞車床同急救裝備'); }   // 車床由車尾推出
    else if(s<3.2){ crew.visible=true; const k=(s-0.8)/2.4; crew.position.lerpVectors(rear,P,k); crew.rotation.y=look(rear,P); walk(C1.c1,t,true); walk(C1.c2,t,true,1); caption('救護員落車，攞車床同急救裝備'); }
    else if(s<5.0){ walk(C1.c1,t,false); walk(C1.c2,t,false); caption(st[0]); kneel(true); C1.c1.userData.arms.forEach(a=>a.rotation.x=-0.8-Math.sin(s*5)*0.4); C1.c2.userData.arms.forEach(a=>a.rotation.x=-0.5-Math.sin(s*3+1)*0.25);
      if(!KIT.visible){ KIT.visible=true; const ax=Math.sin(c.a), az=Math.cos(c.a); KIT.position.set(P.x-az*1.3-ax*0.6,0,P.z+ax*1.3-az*0.6); KIT.rotation.y=c.a+0.4; } }   // 救護員跪低評估，急救袋擺喺側邊
    else if(s<6.6){ caption(st[1]); if(s>6.2) kneel(false); if(patient.parent!==C1.st){ C1.st.attach(patient); patient.position.set(0,0.7,0.3); patient.rotation.set(0,0,0); patient.userData.blanket.visible=true; } }
    else if(s<9.0){ KIT.visible=false; kneel(false); const k=(s-6.6)/2.4; crew.position.lerpVectors(P,rear,k); crew.rotation.y=look(P,rear); walk(C1.c1,t,true); walk(C1.c2,t,true,1); caption(st[2]); }
    else if(s<9.6){ const k=Math.min(1,(s-9.0)/0.5); crew.position.lerpVectors(rear,inside,k); crew.rotation.y=look(rear,inside); walk(C1.c1,t,k<1); walk(C1.c2,t,k<1,1); crew.visible=k<1; }   // 推車床上車
    else if(s>10.6){ toHospital(); bystander.visible=false; }
  } else {
    const D=new THREE.Vector3(AE.door[0],0.15,AE.door[1]); const P=rear.clone().lerp(D,0.85);
    if(s<0.8){ caption('到達急症室，準備交接病人'); crew.visible=s>0.25; if(crew.visible){ const k=Math.min(1,(s-0.25)/0.55); crew.position.lerpVectors(inside,rear,k); crew.rotation.y=look(rear,inside); walk(C1.c1,t,true); walk(C1.c2,t,true,1); } }   // 落車床
    else if(s<4.2){ crew.visible=true; const k=(s-0.8)/3.4; crew.position.lerpVectors(rear,P,k); crew.rotation.y=look(rear,D); walk(C1.c1,t,true); walk(C1.c2,t,true,1); caption('推病人入急症室'); }
    else if(s<7.0){ walk(C1.c1,t,false); walk(C1.c2,t,false); caption('向醫護人員交代病人情況同處理'); }
    else if(s<8.0){ crew.visible=false; caption('任務完成！'); }
    else if(s>9.0){ finish(); }
  }
}
/* ================= 遊戲性：限時、突發事件、病人穩定度、日夜天氣、成就、車款、排行榜 ================= */
const store={ get(k,d){ try{ const v=localStorage.getItem('a188.'+k); return v?JSON.parse(v):d; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem('a188.'+k,JSON.stringify(v)); }catch(e){} } };
// 🎉 歡樂模式狀態（要早過選單同遊戲迴圈定義；功能喺 fun.part.js）
const FUN={ unlocked:!!store.get('funU',0), on:false, score:0, combo:0, comboT:0, slow:0 };   // 每次開遊戲都由關閉開始；解鎖咗嘅話可以喺設定再開
// 🚶 行人自動避開（預設開）：救護車衝埋去會跳開；關咗就會撞倒、瞓喺地下一陣再消失
const DODGE={on:store.get('dodge',true)};
function bestStars(){ return store.get('best2',{}); }
function saveBest(id,st){ const b=bestStars(); if(!(b[id]>=st)){ b[id]=st; store.set('best2',b); } }
function markDone(id){ const d=store.get('done',{}); d[id]=1; store.set('done',d); }
function isDone(id){ return !!store.get('done',{})[id]; }
const getName=()=>store.get('name','')||'';
const totalStars=()=>Object.values(bestStars()).reduce((a,b)=>a+b,0);

/* ---------- 日夜同天氣 ---------- */
const TOD={day:{sky:0xaed8f5,hemi:[0xf4f8ff,0xa8b898,0.62],sun:[0xfff6e8,0.62],fog:[210,560],cloud:0xffffff},
  dusk:{sky:0xf6b993,hemi:[0xffe0c8,0xa08878,0.52],sun:[0xffa060,0.6],fog:[180,520],cloud:0xffd6c0},
  night:{sky:0x18213b,hemi:[0x8090c8,0x202838,0.34],sun:[0x9fb0ff,0.16],fog:[150,460],cloud:0x3a4460,night:true},
  rain:{sky:0x2a3446,hemi:[0x8a9ab0,0x303840,0.38],sun:[0xaab4c8,0.18],fog:[90,330],cloud:0x505a68,night:true,wet:true}};
const headL=new THREE.SpotLight(0xfff4d0,0,70,0.55,0.6,1); headL.position.set(0,2.2,2.5); amb.add(headL); const headT=new THREE.Object3D(); headT.position.set(0,0,30); amb.add(headT); headL.target=headT;
const rain=(()=>{ const N=1400, pos=new Float32Array(N*6); for(let i=0;i<N;i++){ const x=(Math.random()-0.5)*140, y=Math.random()*60, z=(Math.random()-0.5)*140; pos.set([x,y,z,x+0.15,y-1.4,z],i*6); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xb8c8e8,transparent:true,opacity:0.55})); m.visible=false; m.frustumCulled=false; scene.add(m); return m; })();
/* 落雨：地面水花（車附近） */
const SPLASH=(()=>{ const N=70, c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.strokeStyle='rgba(220,235,255,.9)'; g.lineWidth=4; g.beginPath(); g.arc(32,32,24,0,7); g.stroke();
  const im=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,opacity:0.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6}),N);
  im.frustumCulled=false; im.visible=false; scene.add(im); const D=[...Array(N)].map(()=>({x:0,z:0,t:9,l:1})); const o=new THREE.Object3D();
  return { tick(dt){ im.visible=rain.visible; if(!im.visible) return; const c=S.car, fx=Math.sin(c.a), fz=Math.cos(c.a);
    D.forEach((d,i)=>{ d.t+=dt; if(d.t>d.l){ d.t=0; d.l=0.35+Math.random()*0.35; const f=Math.random()*34-6, l=(Math.random()-0.5)*22; d.x=c.x+fx*f+fz*l; d.z=c.z+fz*f-fx*l; d.y=ELEV(d.x,d.z)+0.26; }
      const k=d.t/d.l, sc=0.15+k*0.9; o.position.set(d.x,d.y,d.z); o.rotation.set(-Math.PI/2,0,0); o.scale.set(sc*(1-k*0.3),sc*(1-k*0.3),1); o.updateMatrix(); im.setMatrixAt(i,o.matrix); });
    im.instanceMatrix.needsUpdate=true; } }; })();
/* 夜晚／落雨：車頭燈光柱 */
const BEAM=(()=>{ const m=new THREE.MeshBasicMaterial({color:0xfff1c8,transparent:true,opacity:0.09,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const geo=new THREE.ConeGeometry(2.6,16,16,1,true); geo.translate(0,-8,0); geo.rotateX(-Math.PI/2+0.06);   // 尖端喺車頭燈，向前散開
  const bs=[-0.95,0.95].map(x=>{ const b=new THREE.Mesh(geo,m); b.position.set(x,1.55,3.7); b.visible=false; amb.userData.body.add(b); return b; });
  return { tick(){ const on=!!CARL.night&&S.mode!=='menu'; bs.forEach(b=>b.visible=on); m.opacity=S.wet?0.07:0.045; } }; })();
function rainTick(dt){ SPLASH.tick(dt); BEAM.tick(); if(!rain.visible) return; const p=rain.geometry.attributes.position.array; for(let i=0;i<p.length;i+=6){ p[i+1]-=55*dt; p[i+4]-=55*dt; if(p[i+4]<0){ p[i+1]+=60; p[i+4]+=60; } }
  rain.geometry.attributes.position.needsUpdate=true; rain.position.set(cam.position.x,0,cam.position.z); }
function setTOD(k){ const T=TOD[k]; CARL.night=!!(T.night||k==='rain'); if(typeof NEON!=='undefined'&&NEON) NEON.set(T,k); scene.background.setHex(T.sky); scene.fog.color.setHex(T.sky); scene.fog.near=T.fog[0]; scene.fog.far=T.fog[1]; cam.far=T.fog[1]+60; cam.updateProjectionMatrix();
  hemi.color.setHex(T.hemi[0]); hemi.groundColor.setHex(T.hemi[1]); hemi.intensity=T.hemi[2]; sun.color.setHex(T.sun[0]); sun.intensity=T.sun[1]; CLOUDMAT.color.setHex(T.cloud);
  Object.values(MAT).forEach(m=>{ if(m.map&&m.emissive){ m.emissiveMap=T.night?m.map:null; m.emissive.setHex(T.night?0x2a261c:0); m.needsUpdate=true; } }); // 夜晚：窗口有燈
  headL.intensity=T.night?2.4:0; rain.visible=!!T.wet; S.wet=!!T.wet; }

/* ---------- 限時：每段路程有時限，準時到 +1 生命之星，超時 −1 生命之星 ---------- */
function startLeg(){ setupEvents(); const len=S.route?S.route.len:400; S.legLimit=Math.round(len/16*S.level.limit/1.4+15); if(S.tut) S.legLimit*=3; S.legStart=performance.now()/1000; S.overT=false; }
function legLeft(){ return S.legLimit-(performance.now()/1000-S.legStart); }
function legTimer(){ const r=legLeft(), el=$('hTime');
  if(r>=0){ el.textContent=fmt(r); el.classList.toggle('warn',r<15); }
  else { el.textContent='超時 +'+fmt(-r); el.classList.add('warn'); if(!S.overT){ S.overT=true; loseLife('超時','超時！病人等得太耐'); } } }
function endLeg(){ if(legLeft()>=0){ S.onTime++; if(S.lives<5){ S.lives++; drawLives(); toast('準時到達！獎勵 +1 生命之星'); } else toast('準時到達！'); } }

/* ---------- 病人穩定度（送院途中） ---------- */
function drawStab(){ const v=Math.max(0,S.stab); $('stabBar').style.width=v+'%'; $('stabBar').style.background=v>60?'#21b46b':v>30?'#f5a623':'#e8323c'; $('stabBox').setAttribute('aria-label','病人穩定度 '+Math.round(v)+'%'); }
function stabHit(n){ if(S.step!==4||FUN.on) return; S.stab-=n; S.stabLow=Math.min(S.stabLow,S.stab); drawStab(); }
function stabilityTick(dt,steer){ if(S.step!==4||S.mode!=='drive') return; const c=S.car, v=Math.abs(c.v);
  let drop=0; const lat=v*Math.abs(steer)*2.2*Math.min(1,v/5+0.35); if(lat>26) drop+=(lat-26)*0.35;
  if(S.hold.B&&c.v>12) drop+=9; if(!(cellAt(c.x,c.z)&1)&&v>8) drop+=6;
  if(drop>0){ S.stab-=drop*dt; if(!S.stabWarn||performance.now()-S.stabWarn>4000){ S.stabWarn=performance.now(); if(drop>6) caption('轉彎同煞車要慢慢嚟，病人喺車廂入面！'); } }
  else { S.stab=Math.min(100,S.stab+3*dt); if(S.stabWarn&&performance.now()-S.stabWarn>2500){ caption(null); S.stabWarn=0; } }
  S.stabLow=Math.min(S.stabLow,S.stab); if(S.stab<=0){ S.stab=55; loseLife('病人情況轉差','揸得太急，病人情況轉差！'); } drawStab(); }

/* ---------- 突發事件：修路封路、壞車塞車、行人衝出馬路 ---------- */
const CLOSED=[], EVT={meshes:[],cells:[],stuck:[]};
// 封路圍欄會唔會壓到第隔離另一條路（例如路口附近兩條路貼得好近）
function barrierClear(a,b,r){ const A=NODES[a],B=NODES[b]; const [ux,uz]=dirn(A,B), nx=uz, nz=-ux, M0=[(A[0]+B[0])/2,(A[1]+B[1])/2];
  for(const o of [-r.w/2,-r.w/4,0,r.w/4,r.w/2]) for(const z of [-1.2,1.2]){ const x=M0[0]+nx*o+ux*z, zz=M0[1]+nz*o+uz*z;
    for(const q of MAP.roads){ if(q===r||q.elev) continue; const P=NODES[q.n[0]],Q=NODES[q.n[1]], dx=Q[0]-P[0],dz=Q[1]-P[1],L2=dx*dx+dz*dz||1; let t=((x-P[0])*dx+(zz-P[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); if(Math.hypot(P[0]+dx*t-x,P[1]+dz*t-zz)<q.w/2+1.5) return false; } }
  return true; }
function routeEdges(){ const P=S.route?S.route.path:[]; const out=[]; for(let i=2;i<P.length-3;i++){ const r=EDGE[P[i]+'-'+P[i+1]]; if(r&&!r.bridge&&!r.closed&&r.t!=='avenue'&&barrierClear(P[i],P[i+1],r)){ const A=NODES[P[i]],B=NODES[P[i+1]]; if(Math.hypot(B[0]-A[0],B[1]-A[1])>(DEG[P[i]]>=3||DEG[P[i+1]]>=3?2*Math.max(NW[P[i]]||0,NW[P[i+1]]||0)+24:16)) out.push([P[i],P[i+1],r]); } } return out; }
function closeRoad(a,b,r,lab){ r.closed=true; CLOSED.push(r); const A=NODES[a],B=NODES[b]; const [ux,uz]=dirn(A,B), nx=uz, nz=-ux, M0=[(A[0]+B[0])/2,(A[1]+B[1])/2];
  const g=new THREE.Group(); g.position.set(M0[0],0,M0[1]); g.rotation.y=Math.atan2(ux,uz); scene.add(g); EVT.meshes.push(g);
  const stripe=canvasTex(128,32,(c,w,h)=>{ for(let i=0;i<8;i++){ c.fillStyle=i%2?'#ffffff':'#ff6a13'; c.beginPath(); c.moveTo(i*16,0); c.lineTo(i*16+16,0); c.lineTo(i*16,32); c.lineTo(i*16-16,32); c.fill(); } },true);
  stripe.repeat.set(r.w/4,1); [-1.2,1.2].forEach(z=>{ add(new THREE.BoxGeometry(r.w,0.9,0.25),new THREE.MeshStandardMaterial({map:stripe}),g,0,1.1,z,true);
    for(let x=-r.w/2+0.5;x<=r.w/2;x+=r.w/3) add(new THREE.BoxGeometry(0.2,1.2,0.2),M(0x9aa1aa),g,x,0.6,z,false); });
  for(let x=-r.w/2+1;x<r.w/2;x+=2.2) add(new THREE.ConeGeometry(0.4,1.1,10),M(0xff6a13),g,x,0.7,-3.2,false);
  labelPlane(lab||'修路 請改道',0,2.8,-1.45,Math.PI,'#ff6a13',6,g); labelPlane(lab||'修路 請改道',0,2.8,1.45,0,'#ff6a13',6,g);
  // 碰撞：封住成條路
  for(let o=-r.w/2;o<=r.w/2;o+=1){ for(const z of [-1.2,0,1.2]){ const x=M0[0]+nx*o+ux*z, zz=M0[1]+nz*o+uz*z; const k=gi(x,zz); if(k>=0&&!(grid[k]&2)){ EVT.cells.push(k); grid[k]|=2; } } }
  cars.forEach(c=>{ if(c.road===r&&!c.stuck) c.evict=true; }); return r; } // 封路上面嘅車：出咗鏡頭先搬走
function hazardCar(a,b,r,t,broken){ const m=carModel(broken?'car':['car','taxi','minibus'][Math.random()*3|0]); const c={m,from:a,to:b,road:r,t,stuck:true,yield:0,id:900+EVT.stuck.length};
  if(broken){ c.haz=[[-1,-2.25],[1,-2.25],[-1,2.25],[1,2.25]].map(([x,z])=>add(new THREE.BoxGeometry(0.4,0.25,0.15),new THREE.MeshBasicMaterial({color:0xffa31a}),m.children[0],x*0.85,1.0,z,false));
    const tri=add(new THREE.ConeGeometry(0.5,0.9,3),M(0xff3b30),scene,0,0,0,false); c.tri=tri; EVT.meshes.push(tri); }
  cars.push(c); EVT.stuck.push(c); const p=carPose(c); c.pose=p; m.position.set(p.x,0.1,p.z); m.rotation.y=p.a;
  if(c.tri){ c.tri.position.set(p.x-Math.sin(p.a)*7,0.6,p.z-Math.cos(p.a)*7); } return c; }
function setupEvents(){ const lv=S.level; if(!lv||S.tut) return; const msgs=[];
  for(let n=0;n<lv.works;n++){ const E=routeEdges(); if(!E.length) break; const [a,b,r]=E[(E.length*(0.35+Math.random()*0.4))|0];
    const m0=EVT.meshes.length, c0=EVT.cells.length; closeRoad(a,b,r); refreshRoute(true);
    // 封咗之後搵唔到第二條路（路線仲行緊封咗嗰段）：取消呢個封路，唔好整一道擋路嘅牆
    const P=S.route?S.route.path:[]; let bad=false; for(let i=1;i<P.length;i++){ const q=EDGE[P[i-1]+'-'+P[i]]; if(q&&q.closed) bad=true; }
    if(bad){ EVT.meshes.splice(m0).forEach(m=>scene.remove(m)); EVT.cells.splice(c0).forEach(k=>grid[k]&=~2); r.closed=false; CLOSED.splice(CLOSED.indexOf(r),1); refreshRoute(true); continue; }
    msgs.push((r.name||'前面')+'修路封路'); }
  if(lv.jam&&Math.random()<0.9){ const E=routeEdges(); if(E.length){ const [a,b,r]=E[(E.length*(0.2+Math.random()*0.5))|0]; const L=Math.hypot(NODES[b][0]-NODES[a][0],NODES[b][1]-NODES[a][1]);
      cars.forEach(c=>{ if(c.road===r&&!c.stuck&&!(c.pose&&inView(c.pose.x,c.pose.z))) placeCar(c,S.car.x,S.car.z); });
      hazardCar(a,b,r,0.7,true); for(let q=1;q<=3;q++){ const t=0.7-q*6.5/L; if(t>0.08) hazardCar(a,b,r,t,false); } msgs.push((r.name||'前面')+'有壞車，車龍好長'); } }
  if(msgs.length){ setTimeout(()=>{ if(S.mode!=='drive') return; $('call').textContent='控制中心：'+msgs.join('；')+'。跟住新路線，或者開警號小心越過。'; show('callBox',true); setTimeout(()=>show('callBox',false),4500); },S.step===1?4600:600); } }
function clearEvents(){ EVT.meshes.forEach(m=>scene.remove(m)); EVT.meshes.length=0; EVT.cells.forEach(k=>grid[k]&=~2); EVT.cells.length=0;
  CLOSED.forEach(r=>r.closed=false); CLOSED.length=0; EVT.stuck.forEach(c=>{ scene.remove(c.m); const i=cars.indexOf(c); if(i>=0) cars.splice(i,1); }); EVT.stuck.length=0; }
function dashTick(dt){ if(!(S.dashLeft>0)||!S.leftDepot) return; S.dashT-=dt; const c=S.car; if(S.dashT>0||c.v<10) return;
  const fx=Math.sin(c.a), fz=Math.cos(c.a), P=[c.x+fx*34,c.z+fz*34]; if(!(cellAt(P[0],P[1])&1)){ S.dashT=2; return; }
  const p=peds.find(q=>q.mode!=='dash'&&q.mode!=='down'&&q.pos&&Math.hypot(q.pos[0]-c.x,q.pos[1]-c.z)>60&&!inView(q.pos[0],q.pos[1],4)); if(!p){ S.dashT=2; return; }
  const side=Math.random()<0.5?1:-1, nx=fz*side, nz=-fx*side; if(NEON&&NEON.rail.blockedSeg([P[0]-nx*10,P[1]-nz*10],[P[0]+nx*10,P[1]+nz*10])){ S.dashT=1.5; return; }   // 有欄杆嘅位唔會有人衝出嚟
  Object.assign(p,{mode:'dash',x0:P[0]-nx*10,z0:P[1]-nz*10,nx,nz,s:0,len:20});
  S.dashLeft--; S.dashT=18+Math.random()*14; toast('⚠️ 小心！有人衝出馬路！'); }

/* ---------- 成就同車款 ---------- */
const ACH={first:{ic:'🚑',name:'首次出車',d:'完成任何一關'},perfect:{ic:'✳️',name:'完美任務',d:'保住全部 5 粒生命之星完成一關'},
  ontime:{ic:'⏱️',name:'分秒必爭',d:'到場同送院兩段都準時'},steady:{ic:'🛏️',name:'穩如泰山',d:'送院途中病人穩定度保持 85% 以上'},
  quiz:{ic:'🧠',name:'急救達人',d:'一關入面裝備同小測都答啱'},siren:{ic:'🚨',name:'鳴笛開路',d:'有開警號，而且冇衝紅燈'},
  night:{ic:'🌙',name:'夜更英雄',d:'完成夜晚或者落雨嘅關卡'},yield:{ic:'🛣️',name:'有序開路',d:'一關入面響警號順利越過 5 架讓路車'},all:{ic:'🏅',name:'屯門元朗守護者',d:'完成全部關卡'}};
function ach(id){ const a=store.get('ach',{}); if(a[id]) return; a[id]=Date.now(); store.set('ach',a); S.newAch.push(id); }
/* ---------- 車款：救護車（黃／經典白）、救護電單車、警車、消防車、的士、巴士 ---------- */
// vmax 最高速、acc 加速倍數、steer 轉向、siren 有冇警號、lc 閃燈顏色、tone 警號音 [高,低,間隔ms]
// circ 車身碰撞圓心（沿車身）、kl/kw 車身長闊比例、nose 車頭距離車中心
const LIVERY=[
 {id:'yellow',kind:'amb',name:'救護車（標準黃色）',col:0xffe500,sw:'#ffe500',need:0,vmax:31,acc:1,steer:2.2,siren:true,lc:[0x3a88ff,0x3a88ff],tone:[960,770,560],circ:[-2.2,0,2.2],kl:1,kw:1,nose:2.6,d:'標準性能'},
 {id:'white',kind:'amb',name:'救護車（經典白色）',col:0xf4f6f8,sw:'#f4f6f8',need:4,vmax:31,acc:1,steer:2.2,siren:true,lc:[0x3a88ff,0x3a88ff],tone:[960,770,560],circ:[-2.2,0,2.2],kl:1,kw:1,nose:2.6,d:'舊款紅黃斜紋塗裝，標準性能'},
 {id:'moto',kind:'moto',name:'救護電單車',sw:'#d7ff2e',need:8,vmax:38,acc:1.35,steer:2.75,siren:true,lc:[0x3a88ff,0x3a88ff],tone:[960,770,560],circ:[-0.7,0.7],kl:0.42,kw:0.4,nose:1.4,d:'最快最靈活，藍色閃燈'},
 {id:'police',kind:'police',name:'警車',sw:'linear-gradient(#fff 35%,#d8202a 35%,#d8202a 50%,#1f4fbf 50%,#1f4fbf 70%,#fff 70%)',need:12,vmax:34,acc:1.15,steer:2.4,siren:true,lc:[0x3a88ff,0xff2a2a],tone:[1150,820,330],circ:[-1.9,0,1.9],kl:0.9,kw:0.9,nose:3.0,d:'快少少，紅藍閃燈'},
 {id:'fire',kind:'fire',name:'消防車',sw:'linear-gradient(#ffc400 30%,#d8202a 30%)',need:17,vmax:28,acc:0.85,steer:1.95,siren:true,lc:[0xff2a2a,0xff2a2a],tone:[720,540,640],circ:[-2.2,0,2.2],kl:1,kw:1,nose:3.3,d:'車身重、較慢，紅色閃燈'},
 {id:'taxi',kind:'taxi',name:'的士',sw:'#2bb04a',need:22,vmax:33,acc:1.1,steer:2.5,siren:false,lc:[0,0],tone:[0,0,500],circ:[-1.4,1.4],kl:0.7,kw:0.85,nose:2.25,d:'冇警號冇閃燈：其他車唔會讓路，要守交通燈'},
 {id:'bus',kind:'bus',name:'雙層巴士',sw:'#e8343a',need:27,vmax:24,acc:0.65,steer:1.6,siren:false,lc:[0,0],tone:[0,0,500],circ:[-3.4,-1.2,1.2,3.4],kl:1.45,kw:1,nose:4.5,d:'又大又慢、冇警號：最高難度'}];
let VSPEC=LIVERY[0], CURL=amb.userData.blues;
amb.add(amb.userData.pB,amb.userData.pR);   // 閃燈光源搬去車組，換車身都照用
const AMB_Y=[]; amb.traverse(o=>{ if(o.isMesh&&o.material&&o.material.color&&o.material.color.getHex()===0xffe500&&!AMB_Y.includes(o.material)) AMB_Y.push(o.material); });
const lamp=(w,h,d,col,on,par,x,y,z)=>{ const m=add(rbox(w,h,d,0.05),M(col),par,x,y,z,false); m.userData.on=on; return m; };
const ptex=(key,w,h,draw)=>vtex('pv'+key,w,h,draw);
const chev=(g,x0,y0,w,h,sw,c1,c2)=>{ g.save(); g.beginPath(); g.rect(x0,y0,w,h); g.clip(); for(let i=-2;i*sw<w+h;i++){ g.fillStyle=(i&1)?c1:c2; g.beginPath(); g.moveTo(x0+i*sw,y0+h); g.lineTo(x0+i*sw+h,y0); g.lineTo(x0+i*sw+h+sw,y0); g.lineTo(x0+i*sw+sw,y0+h); g.fill(); } g.restore(); };
const SKB={
 /* 消防車（輕型泵車款）：紅車身、黃色車頂邊、銀色捲閘、車頂紅色燈排 */
 fire(){ const g=new THREE.Group(); const red='#d8202a', yel='#ffc400';
  const side=f=>ptex('fireS'+f,1024,368,(c,W,H)=>{ const X=x=>f?x:W-x, R=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); c.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
    c.fillStyle=red; c.fillRect(0,0,W,H); c.fillStyle=yel; c.fillRect(0,0,W,46);
    [[40,330],[350,640]].forEach(([a,b])=>{ c.fillStyle='#c9ced4'; R(a,70,b,300); c.fillStyle='rgba(0,0,0,.16)'; for(let y=78;y<300;y+=12) R(a,y,b,y+3); c.strokeStyle='#8a9098'; c.lineWidth=5; c.strokeRect(Math.min(X(a),X(b)),70,Math.abs(b-a),230); });
    c.fillStyle='#20262e'; R(700,74,790,170); R(830,74,990,180);                    // 後座窗、駕駛室窗
    c.strokeStyle='rgba(0,0,0,.3)'; c.lineWidth=4; c.strokeRect(Math.min(X(815),X(1000)),60,185,270);
    chev(c,Math.min(X(690),X(1010)),236,320,40,26,yel,red);
    c.fillStyle=yel; c.font='bold 30px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('RESCUE',X(910),208);
    c.fillStyle='rgba(0,0,0,.35)'; c.fillRect(0,H-26,W,26); });
  const front=ptex('fireF',256,236,(c,W,H)=>{ c.fillStyle=red; c.fillRect(0,0,W,H); c.fillStyle=yel; c.fillRect(0,0,W,28);
    c.fillStyle='#20262e'; c.fillRect(22,36,W-44,78); c.fillStyle=yel; c.fillRect(50,122,W-100,22); c.fillRect(34,150,W-68,24);
    c.fillStyle=red; c.font='bold 17px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('救 RESCUE 援',W/2,134); c.fillText('消 FIRE SERVICES 防',W/2,163);
    c.fillStyle='#16181c'; c.fillRect(60,182,W-120,34); c.fillStyle='#fff6d0'; c.fillRect(18,186,34,26); c.fillRect(W-52,186,34,26); });
  const rear=ptex('fireR',256,236,(c,W,H)=>{ c.fillStyle=red; c.fillRect(0,0,W,H); c.fillStyle=yel; c.fillRect(0,0,W,30); c.fillStyle='#c9ced4'; c.fillRect(30,40,W-60,150);
    c.fillStyle='rgba(0,0,0,.16)'; for(let y=46;y<190;y+=10) c.fillRect(30,y,W-60,3); c.strokeStyle='#e8ecef'; c.lineWidth=4; c.strokeRect(150,36,50,170); for(let y=52;y<200;y+=22){ c.beginPath(); c.moveTo(150,y); c.lineTo(200,y); c.stroke(); }
    c.fillStyle='#ff4040'; c.fillRect(10,196,30,18); c.fillRect(W-40,196,30,18); c.fillStyle=yel; c.fillRect(96,200,64,20); });
  const base=solid(0xd8202a);
  vbox(2.55,2.5,6.5,[side(true),side(false),base,base,front,rear],g,0,1.85,0);
  vbox(2.6,0.14,6.55,base,g,0,3.15,0,false);
  [-0.75,0.75].forEach(x=>{ const r=add(cyl(0.05,0.05,5.0,6),M(0xc9ced4),g,x,3.42,-0.6,false); r.rotation.x=Math.PI/2; });
  [-2.6,-1.4,-0.2,1.0].forEach(z=>add(new THREE.BoxGeometry(1.5,0.05,0.06),M(0xc9ced4),g,0,3.42,z,false));
  [[-1.1,-2.9],[1.1,-2.9],[-1.1,1.4],[1.1,1.4]].forEach(([x,z])=>add(cyl(0.04,0.04,0.3,6),M(0xc9ced4),g,x,3.3,z,false));
  const blues=[lamp(0.9,0.24,0.34,0xb81818,0xff1a1a,g,-0.62,3.36,2.7), lamp(0.9,0.24,0.34,0xb81818,0xff1a1a,g,0.62,3.36,2.7), lamp(0.5,0.2,0.2,0xb81818,0xff1a1a,g,-0.9,3.3,-3.1), lamp(0.5,0.2,0.2,0xb81818,0xff1a1a,g,0.9,3.3,-3.1)];
  { const s=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.2),new THREE.MeshBasicMaterial({map:tex([{t:'FIRE',f:'bold 44px sans-serif'}],'#ffffff','#d8202a',128,56)})); s.position.set(0,3.36,2.88); g.add(s); }
  wheelsAt(g,[[-1.15,2.05],[1.15,2.05],[-1.15,-1.95],[1.15,-1.95]],0.58,0.42); g.userData.blues=blues; return g; },
 /* 警車（白色客貨車）：紅藍紅腰帶、「警 POLICE 察」、車頂藍紅閃燈 */
 police(){ const g=new THREE.Group(); const red='#d8202a', blu='#1f3fa8';
  const side=f=>ptex('polS'+f,1024,400,(c,W,H)=>{ const X=x=>f?x:W-x, R=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); c.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
    c.fillStyle='#f4f6f8'; c.fillRect(0,0,W,H);
    c.fillStyle='#20262e'; R(40,50,300,170); R(320,50,560,170); R(600,50,740,170); R(770,56,900,170);
    c.fillStyle='rgba(255,255,255,.14)'; for(let x=44;x<560;x+=14) R(x,50,x+3,170);     // 車窗鐵網
    c.fillStyle=red; R(0,196,930,300); c.fillStyle=blu; R(0,222,930,274);
    c.fillStyle='#fff'; c.font='bold 40px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(f?'警 POLICE 察':'警 POLICE 察',X(420),250);
    c.strokeStyle='rgba(0,0,0,.22)'; c.lineWidth=4; c.strokeRect(Math.min(X(590),X(750)),40,160,320); c.strokeRect(Math.min(X(760),X(910)),40,150,320);
    c.fillStyle='rgba(0,0,0,.3)'; c.fillRect(0,H-22,W,22); });
  const front=ptex('polF',256,200,(c,W,H)=>{ c.fillStyle='#f4f6f8'; c.fillRect(0,0,W,H); c.fillStyle=red; c.fillRect(0,20,W,50); c.fillStyle=blu; c.fillRect(0,32,W,26);
    c.fillStyle='#fff'; c.font='bold 22px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('POLICE',W/2,46);
    c.fillStyle='#16181c'; c.fillRect(70,92,W-140,50); c.fillStyle='#fff6d0'; c.fillRect(14,96,46,34); c.fillRect(W-60,96,46,34); c.fillStyle='#16181c'; c.fillRect(0,160,W,40); });
  const rear=ptex('polR',256,400,(c,W,H)=>{ c.fillStyle='#f4f6f8'; c.fillRect(0,0,W,H); c.fillStyle='#20262e'; c.fillRect(24,50,96,120); c.fillRect(136,50,96,120);
    c.fillStyle=red; c.fillRect(0,196,W,104); c.fillStyle=blu; c.fillRect(0,222,W,52); c.fillStyle='#fff'; c.font='bold 34px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('POLICE',W/2,250);
    c.fillStyle='#ff4040'; c.fillRect(6,310,22,50); c.fillRect(W-28,310,22,50); c.strokeStyle='rgba(0,0,0,.25)'; c.lineWidth=3; c.beginPath(); c.moveTo(W/2,30); c.lineTo(W/2,380); c.stroke(); });
  const wh=solid(0xf4f6f8), gl=M(C.glass,{r:0.2});
  vbox(2.3,2.3,5.2,[side(true),side(false),wh,wh,wh,rear],g,0,1.65,-0.45);
  vbox(2.28,1.15,0.95,[wh,wh,wh,wh,front,wh],g,0,1.08,2.6);
  const ws=add(new THREE.BoxGeometry(2.1,1.15,0.08),gl,g,0,2.18,2.36,false); ws.rotation.x=-0.5;
  const fill=add(new THREE.BoxGeometry(2.28,0.2,0.5),wh,g,0,2.72,2.0,false);
  const blues=[lamp(0.85,0.2,0.32,0x2f6bff,0x1550ff,g,-0.5,2.92,1.5), lamp(0.85,0.2,0.32,0xc22020,0xff1a1a,g,0.5,2.92,1.5), lamp(0.3,0.14,0.1,0xc22020,0xff1a1a,g,-0.6,1.42,3.09), lamp(0.3,0.14,0.1,0x2f6bff,0x1550ff,g,0.6,1.42,3.09)];
  add(new THREE.BoxGeometry(2.0,0.08,0.4),M(0x2b2d33),g,0,2.82,1.5,false);
  wheelsAt(g,[[-1.05,1.9],[1.05,1.9],[-1.05,-1.9],[1.05,-1.9]],0.5,0.38); g.userData.blues=blues; return g; },
 /* 救護電單車：螢光黃車身、紅色斜紋、尾箱生命之星、藍色閃燈 */
 moto(){ const g=new THREE.Group(); const Yf=M(0xd7ff2e,{r:0.4,e:0x1c2400}), dk=M(C.dark), red=M(0xe8202a);
  const pan=ptex('motoP',128,96,(c,W,H)=>{ c.fillStyle='#d7ff2e'; c.fillRect(0,0,W,H); chev(c,0,30,W,36,22,'#e8202a','#d7ff2e'); c.fillStyle='#1c1c1c'; c.fillRect(0,0,W,10); c.fillRect(0,H-10,W,10); });
  const topT=ptex('motoT',128,96,(c,W,H)=>{ c.fillStyle='#d7ff2e'; c.fillRect(0,0,W,H); c.fillStyle='#e8202a'; c.fillRect(0,H-26,W,26); drawStar(c,W/2,38,28); });
  [1.0,-1.0].forEach(z=>{ const w=add(cyl(0.44,0.44,0.2,16),dk,g,0,0.44,z); w.rotation.z=Math.PI/2; add(cyl(0.2,0.2,0.22,10),M(0xc9ced4),g,0,0.44,z,false).rotation.z=Math.PI/2; });
  add(rbox(0.42,0.5,1.05,0.1),M(0x5b6270),g,0,0.62,0.0);                      // 引擎
  add(rbox(0.62,0.5,1.0,0.18),Yf,g,0,1.08,0.38);                               // 油缸
  add(rbox(0.5,0.12,0.4,0.05),red,g,0,1.2,0.5,false);
  add(rbox(0.56,0.42,0.55,0.15),Yf,g,0,1.25,0.98);                             // 車頭罩
  add(rbox(0.3,0.16,0.3,0.06),Yf,g,0,0.95,1.3);                                // 鳥嘴
  const ws=add(new THREE.BoxGeometry(0.5,0.6,0.05),M(C.glass,{r:0.15,op:0.6}),g,0,1.72,1.02,false); ws.rotation.x=-0.35;
  add(sph(0.11),M(0xfff6c4,{e:0x554400}),g,0,1.3,1.27,false);
  const fk=add(cyl(0.05,0.05,0.95,8),M(0xc9ced4),g,0,0.85,1.05,false); fk.rotation.x=0.35;
  const hb=add(cyl(0.035,0.035,0.9,8),dk,g,0,1.5,0.72,false); hb.rotation.z=Math.PI/2;
  add(rbox(0.44,0.16,0.85,0.06),dk,g,0,1.02,-0.4);                             // 座位
  add(rbox(0.4,0.3,0.5,0.08),Yf,g,0,0.86,-1.0);                                // 尾殼
  [-1,1].forEach(s=>vbox(0.34,0.6,0.85,[pan,pan,solid(0x1c1c1c),solid(0x1c1c1c),pan,pan],g,s*0.5,0.86,-0.92));
  vbox(0.62,0.46,0.6,[topT,topT,solid(0xd7ff2e),solid(0xd7ff2e),topT,topT],g,0,1.42,-1.08);
  add(cyl(0.02,0.02,0.6,6),M(0x9aa1ab),g,0.26,1.95,-1.3,false);
  const blues=[lamp(0.14,0.18,0.14,0x2f6bff,0x1550ff,g,0.26,2.3,-1.3), lamp(0.16,0.12,0.1,0x2f6bff,0x1550ff,g,-0.34,1.42,1.08), lamp(0.16,0.12,0.1,0x2f6bff,0x1550ff,g,0.34,1.42,1.08)];
  // 救護員（頭盔）
  const r=person('crew'); r.scale.set(0.62,0.62,0.62); r.position.set(0,0.78,-0.38); r.rotation.x=0.12; g.add(r);
  r.children.forEach(o=>{ if(o.position.y>1.9) o.scale.multiplyScalar(0.01); });   // 收起大頭，換細頭盔
  const hm=add(sph(0.27),M(0xf4f6f8,{r:0.3}),g,0,1.98,-0.2); hm.scale.set(1,0.95,1.1); add(new THREE.BoxGeometry(0.36,0.13,0.08),M(C.glass,{r:0.1}),g,0,1.96,0.07,false);
  g.userData.blues=blues; return g; },
 /* 的士：綠色新界的士（同路面嗰款一樣），冇警號 */
 taxi(){ const g=new THREE.Group(); taxiModel(g,true); g.scale.setScalar(1.05); g.userData.blues=[]; return g; },
 /* 雙層巴士：紅色，縮細少少方便出入車房，冇警號 */
 bus(){ const r=Math.random; Math.random=()=>0; const g=busModel(); Math.random=r; g.scale.setScalar(0.78); g.userData.blues=[]; return g; }
};
const SKINS={};
function applyLivery(id){ const L=LIVERY.find(l=>l.id===id)||LIVERY[0]; VSPEC=L; const U=amb.userData, isAmb=L.kind==='amb';
  U.body.visible=isAmb; for(const k in SKINS) SKINS[k].visible=false;
  if(isAmb){ AMB_Y.forEach(m=>{ m.color.setHex(L.col); m.emissive.setHex(L.id==='white'?0x262626:0x3a3300); }); U.setClassic(L.id==='white'); CURL=U.blues; }
  else { let s=SKINS[L.kind]; if(!s){ s=SKINS[L.kind]=SKB[L.kind](); amb.add(s); s.position.set(0,0,0); s.rotation.set(0,0,0); s.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); } s.visible=true; CURL=s.userData.blues; }
  U.pB.color.setHex(L.lc[0]||0x3a88ff); U.pR.color.setHex(L.lc[1]||0x3a88ff);
  const bh=$('bH'); bh.textContent=L.siren?'警號':'響咹'; bh.setAttribute('aria-label',L.siren?'警號開關':'響咹');
  try{ if(S.siren) sirenSet(false); }catch(e){}
  store.set('livery',L.id); }

function checkLiveryUnlock(){ const tot=totalStars(), seen=store.get('livSeen',0); const nu=LIVERY.filter(l=>l.need>seen&&l.need<=tot);
  if(nu.length){ $('rAch').innerHTML+=(($('rAch').innerHTML)?'<br>':'')+'<b>🚑 新車款：</b>'+nu.map(l=>l.name).join('、')+'（去「車款」換）'; } store.set('livSeen',Math.max(seen,tot)); }
applyLivery(store.get('livery','yellow'));

/* ---------- 排行榜：本機＋（如有）網上 ---------- */
let DB=null, UID=null;
(async()=>{ try{ if(typeof claude==='undefined'||!claude.use) return; const db=await claude.use('db'), u=await claude.use('user'); if(db&&u){ const id=await u.id(); if(id){ DB=db; UID=id; if(S.mode==='menu'&&S.tab==='board') renderMenu('board'); } } }catch(e){} })();
function rankSort(a,b){ return b.st-a.st||a.tm-b.tm; }
async function saveScore(){ const n=($('rName').value||'').trim().slice(0,12)||(S.gm==='taxi'?'無名司機':S.gm==='chase'?'無名車手':'無名救護員'); store.set('name',n); const lv=S.level.id; const rec={n,st:S.stars,tm:Math.round(S.tHosp),d:Date.now()};
  const lb=store.get('lb',{}); lb[lv]=(lb[lv]||[]).concat([rec]).sort(rankSort).slice(0,5); store.set('lb',lb);
  $('rSave').disabled=true; $('rSave').textContent='已儲存 ✓';
  if(DB&&UID){ try{ const ref=DB.doc('board/'+UID); const cur=await ref.get(); const body=cur.exists?JSON.parse(JSON.stringify(cur.data())):{lv:{}};
      body.n=n; body.lv=body.lv||{}; const old=body.lv[lv]; if(!old||rankSort(rec,old)<0) body.lv[lv]={st:rec.st,tm:rec.tm}; await ref.set(body); $('rSave').textContent='已儲存（網上）✓'; }catch(e){} } }
$('rSave').onclick=saveScore;
async function onlineBoard(lv,box){ if(!DB){ box.textContent='（網上排行榜：分享俾朋友，佢哋有「可使用」權限就可以一齊上榜）'; return; }
  box.textContent='載入緊…'; let done=false; const tmo=setTimeout(()=>{ if(!done) box.textContent='暫時連唔到網上排行榜'; },10000);
  try{ const q=await DB.collection('board').limit(300).get(); done=true; clearTimeout(tmo);
    const rows=q.docs.map(d=>{ const v=d.data()||{}; const r=v.lv&&v.lv[lv]; return r?{n:String(v.n||'無名').slice(0,12),st:+r.st||0,tm:+r.tm||0,me:d.id===UID}:null; }).filter(Boolean).sort(rankSort).slice(0,10);
    box.textContent=''; if(!rows.length){ box.textContent='暫時未有人上榜，做第一個！'; return; } box.append(boardTable(rows)); }catch(e){ done=true; clearTimeout(tmo); box.textContent='暫時連唔到網上排行榜'; } }
function boardTable(rows){ const t=document.createElement('table'); t.className='board'; rows.forEach((r,i)=>{ const tr=t.insertRow(); const c0=tr.insertCell(); c0.textContent=(i+1)+'.';
  const c1=tr.insertCell(); c1.className='n'; c1.textContent=r.n+(r.me?'（你）':''); const c2=tr.insertCell(); const isT=S.boardLv==='TAXI'&&S.mode==='menu'; if(isT) c2.textContent='$'+r.st; else c2.innerHTML=[...Array(r.st)].map(()=>'<i class="on">'+lifeStar(13)+'</i>').join(''); c2.style.color=isT?'#1f8f3a':'#ff3b5c';
  const isC=S.boardLv==='CHASE'&&S.mode==='menu'; if(isC&&!r.st){ c2.textContent='💔'; }
  const c3=tr.insertCell(); c3.className='r'; c3.textContent=isT?'':isC?'撐 '+(60-r.tm)+' 秒':fmt(r.tm); }); return t; }

/* ---------- 選單 ---------- */
function renderMenu(tab){ if(!tab&&!S.tab){ const o=store.get('openTab',null); if(o){ store.set('openTab',null); tab=o; } } tab=tab||S.tab||'levels'; S.tab=tab; const B=$('tabBody'); B.innerHTML='';
  document.querySelectorAll('#tabs button').forEach(b=>{ b.setAttribute('aria-selected',b.dataset.t===tab); b.onclick=()=>renderMenu(b.dataset.t); });
  const best=bestStars(), el=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };
  if(S.unlockMsg){ S.unlockMsg=false; B.append(el('p','ach-new','🔓 已解鎖全部關卡、知識卡同車款！')); }
  if(tab==='levels'){ S.menuMode=S.menuMode||store.get('menuMode',REGION==='st'?'st':'ems'); if(S.menuMode!=='real'&&(S.menuMode==='st')!==(REGION==='st')) S.menuMode=REGION==='st'?'st':'ems';
    const MODES=[['ems','🚑','救護任務',true],['real','🎬','寫實模式',true],['taxi','🚕','的士接客',true],['chase','🚓','追逐模式',true],['free','🚶','自由探索',true],['cpr','❤️','CPR（測試）',true],['st','🏥','救護任務（沙田）',true]];
    const mr=el('div','modes'); MODES.forEach(([id,ic,nm,on])=>{ const b=el('button','mode'+(S.menuMode===id?' on':'')); b.disabled=!on; b.append(el('span','mi',ic),el('b',null,nm),el('small',null,on?'':'即將推出')); b.onclick=()=>{ const need=id==='st'?'st':id==='real'?REGION:'tm'; if(need!==REGION){ store.set('region',need); store.set('menuMode',id); B.innerHTML='<p style="text-align:center;padding:30px 0">🗺️ 載入'+(need==='st'?'沙田':'屯門')+'地圖中……</p>'; setTimeout(()=>location.reload(),60); return; } S.menuMode=id; store.set('menuMode',id); renderMenu('levels'); }; mr.append(b); }); B.append(mr);
    if(S.menuMode==='taxi'){ B.append(el('p',null,'60 秒內不停接客送客！停喺乘客旁邊就上車，跟橙色導航線送到目的地。'));
      const lg=el('div','txleg'); [['o','橙色','近程','$10','+5 秒'],['y','黃色','中程','$25','+8 秒'],['g','綠色','遠程','$50','+12 秒']].forEach(([k,n,dd,m,s])=>{ const r=el('div'); const dot=el('span','dot'); dot.style.background=TX.cls[k].css; r.append(dot,el('b',null,n+' '+dd),el('span',null,m+' · '+s)); lg.append(r); }); B.append(lg);
      B.append(el('p',null,'提早送到有貼士。撞車、撞人、衝紅燈都冇罰，只會慢落嚟。'));
      B.append(el('p','txbest','最高紀錄：$'+store.get('taxiBest',0)));
      const go=el('button','go','🚕 開始接客'); go.onclick=()=>startTaxi(); B.append(go); return; }
    if(S.menuMode==='cpr'){ B.append(el('p',null,'行街時見到有人突然暈低、不省人事，你識唔識救？跟消防處 CPR 同 AED 教材，由確定環境安全開始，一步一步練習。'));
      const ul=el('ul','chlist'); ['① 冷靜：確定現場環境安全','② 檢查：輕拍膊頭、大聲叫，確定人事不省','③ 召喚：叫途人幫手打 999、攞 AED','④ 打開氣道，用少過 10 秒檢查呼吸','⑤ CPR：每分鐘 100–120 下，壓 5–6 公分','⑥ AED：開機 → 貼電極片 → 分析及電擊'].forEach(x=>ul.append(el('li',null,x))); B.append(ul);
      const g1=el('button','go','📖 教學模式'); g1.style.background='#e0465e'; g1.onclick=()=>startCPR('teach',false); B.append(g1);
      B.append(el('p',null,'教學模式：每一步有解說同提示（單純按壓式 CPR）。練習模式：冇提示，做錯先會提醒你。'));
      const row=el('div','cpsel'); let br=store.get('cprBreaths',false); const mk=(v,t)=>{ const b=el('button',br===v?'on':'',t); b.onclick=()=>{ store.set('cprBreaths',v); renderMenu('levels'); }; return b; };
      row.append(mk(false,'單純按壓'),mk(true,'30 按壓 + 2 人工呼吸')); B.append(el('p',null,'練習模式按壓方式：')); B.append(row);
      const g2=el('button','go','🫀 練習模式'); g2.style.background='#c2185b'; g2.onclick=()=>startCPR('practice',br); B.append(g2); return; }
    if(S.menuMode==='free'){ B.append(el('p',null,'冇時間限制、冇計分，喺屯門同元朗周圍行，見到咩車都可以上去揸！'));
      const ul=el('ul','chlist'); ['行近任何一部車撳「上車」：路上嘅車司機會自己落車行開','路邊泊咗救護車、警車、消防車、救護電單車俾你試','停定車撳「落車」，架車會泊喺原位，可以再上','手機：左下角搖桿行路，右下角「跳」「上車」','電腦：WASD 行路，空白鍵跳，E 上落車，滑鼠拉動轉鏡頭'].forEach(x=>ul.append(el('li',null,x))); B.append(ul);
      const go=el('button','go','🚶 開始探索'); go.style.background='#7b4fd6'; go.onclick=()=>startFree(); B.append(go); return; }
    if(S.menuMode==='chase'){ const L=LIVERY.find(l=>l.id===store.get('livery','yellow'))||LIVERY[0];
      B.append(el('p',null,'警車開住警號追你！喺隨機地點開始，撐夠 60 秒就成功逃脫。'));
      const ul=el('ul','chlist'); ['有 5 粒生命之星：撞到警車或者路障扣 1 粒，扣晒就被捕','每 12 秒多一架警車，最多 6 架；路障越嚟越多','路障留咗一條窄位，可以鑽過去','撞到人唔扣分，佢哋會彈開再起身','開警號，路上啲車會讓路'].forEach(x=>ul.append(el('li',null,x))); B.append(ul);
      B.append(el('p',null,'使用車款：'+L.name+'（喺「車款」分頁可以換）'));
      const cb=store.get('chaseBest',{st:0,s:0}); B.append(el('p','txbest','最佳紀錄：'+(cb.st?cb.st+' 粒生命之星逃脫':cb.s?'撐 '+cb.s+' 秒':'未有')));
      const go=el('button','go','🚓 開始追逐'); go.style.background='#1f4fbf'; go.onclick=()=>startChase(); B.append(go); return; }
    if(S.menuMode==='real') B.append(el('p','realIntro','🎬 寫實模式：電影感黃昏光影、光暈同調色、低鏡頭跟車，加上派遣接 Call（RES 接受／REJ 拒絕）、圓形小地圖、狀態條、分數同時鐘。用嘅係'+(REGION==='st'?'沙田':'屯門')+'嘅關卡（要較新嘅手機）。'));
    B.append(el('p',null,REGION==='st'?'沙田區：由沙田或者田心救護站出車，到場處理，再送去威爾斯親王醫院急症室。完成一關解鎖下一關：':'由屯門救護站出車，到場處理，再送去屯門醫院急症室。完成一關解鎖下一關：'));
    if(S.menuMode==='ems'){ const tb=el('button','go','🎓 新手教學（第一次玩建議先試）'); tb.style.cssText='background:#ffb703;color:#3a2a00;margin:0 0 10px'; tb.onclick=()=>{ S.realPick=false; S.tutPick=true; startCase(0); }; B.append(tb); }
    const box=el('div'); box.id='cases'; LEVELS.forEach((lv,i)=>{ const k=caseOf(lv), lock=!unlockedAll()&&i>0&&!isDone(LEVELS[i-1].id), st=best[lv.id]||0;
      const b=el('button','case'+(lock?' locked':'')); b.disabled=lock;
      b.append((()=>{ const x=el('span','pl','第 '+(i+1)+' 關 · '+lv.todName+(lv.works?' · 修路':'')+(lv.jam?' · 塞車':'')); if(isDone(lv.id)) x.insertAdjacentHTML('beforeend',PLAY.chalHTML(lv.id)); return x; })(), el('b',null,(lock?'🔒 ':'')+k.place+'：'+k.title), (()=>{ const x=el('span','st'); x.innerHTML=[0,1,2,3,4].map(i=>'<i class="'+(i<st?'on':'off')+'">'+lifeStar(14)+'</i>').join(''); return x; })());
      if(lv.support&&lv.support.length) b.append(el('span','sup',supTags(lv).join(' · ')));
      b.onclick=()=>{ S.realPick=S.menuMode==='real'; startCase(i); }; box.append(b); }); B.append(box);
    const r=el('div','rules'); r.innerHTML='<b>點玩：</b>◀ ▶ 轉彎，按住「油」前進，「倒」倒車；撳「警號」開閃燈同警號，其他車會讓路，可以安全過紅燈。<br><b>限時：</b>準時到 +1 生命之星，超時 −1 生命之星。<br><b>生命之星：</b>5 粒；撞車、撞樓、撞人、冇警號衝紅燈、揀錯裝備、答錯小測、病人穩定度跌晒，每次 −1 生命之星，扣晒遊戲結束。<br><b>送院：</b>轉彎同煞車要慢慢嚟，保持病人穩定。'; B.append(r); }
  if(tab==='cards'){ B.append(el('p',null,'完成關卡就收集到嗰個個案嘅急救知識卡：'));
    LEVELS.forEach((lv,i)=>{ const k=caseOf(lv), d=el('div','kcard'+(isDone(lv.id)||unlockedAll()?'':' lock'));
      if(isDone(lv.id)||unlockedAll()){ d.append(el('b',null,'📗 '+k.title+'（'+k.place+'）')); const ul=el('ul'); k.tips.forEach(t=>ul.append(el('li',null,t))); d.append(ul); }
      else d.append(el('b',null,'🔒 完成第 '+(i+1)+' 關解鎖')); B.append(d); }); }
  if(tab==='ach'){ const got=store.get('ach',{}); B.append(el('p',null,'已解鎖 '+Object.keys(got).length+' / '+Object.keys(ACH).length+' 個成就'));
    const l=el('div','achl'); Object.entries(ACH).forEach(([id,a])=>{ const d=el('div','achi'+(got[id]?'':' lock')); d.append(el('span','ic',got[id]?a.ic:'🔒')); const t=el('div'); t.append(el('b',null,a.name),el('small',null,a.d)); d.append(t); l.append(d); }); B.append(l); }
  if(tab==='board'){ const sel=el('div','lvsel'); S.boardLv=S.boardLv||LEVELS[0].id; LEVELS.forEach((lv,i)=>{ const b=el('button',lv.id===S.boardLv?'on':null,'第'+(i+1)+'關'); b.onclick=()=>{ S.boardLv=lv.id; renderMenu('board'); }; sel.append(b); }); { const b=el('button',S.boardLv==='TAXI'?'on':null,'🚕 的士'); b.onclick=()=>{ S.boardLv='TAXI'; renderMenu('board'); }; sel.append(b); }
    { const b=el('button',S.boardLv==='CHASE'?'on':null,'🚓 追逐'); b.onclick=()=>{ S.boardLv='CHASE'; renderMenu('board'); }; sel.append(b); } B.append(sel);
    B.append(el('div','bhead','📱 呢部機嘅紀錄')); const lb=store.get('lb',{})[S.boardLv]||[]; if(lb.length) B.append(boardTable(lb)); else B.append(el('p',null,'未有紀錄。完成關卡後喺結算畫面儲存。'));
    B.append(el('div','bhead','🌐 網上排行榜')); const ob=el('div'); B.append(ob); onlineBoard(S.boardLv,ob); }
  if(tab==='set'){ const C=ANI.cfg(), save=()=>{ ANI.setCfg(C); renderMenu('set'); };
    const sec=t=>B.append(el('h3','set-h',t));
    const row=(lab,ctrl,sub)=>{ const r=el('div','set-row'); const l=el('div','set-l'); l.append(el('b',null,lab)); if(sub) l.append(el('small',null,sub)); r.append(l,ctrl); B.append(r); return r; };
    const sw=(on,fn,label)=>{ const b=el('button','set-sw'+(on?' on':''),on?'開':'關'); b.setAttribute('role','switch'); b.setAttribute('aria-checked',on); b.setAttribute('aria-label',label); b.disabled=['飛機','麻鷹'].includes(label)&&!C.on; b.onclick=()=>{ fn(!on); save(); }; return b; };
    const step=(v,mn,mx,fn,label)=>{ const w=el('div','set-step'); const m=el('button',null,'－'), p=el('button',null,'＋'), n=el('span',null,String(v));
      m.setAttribute('aria-label',label+'減少'); p.setAttribute('aria-label',label+'增加'); m.disabled=v<=mn||!C.on; p.disabled=v>=mx||!C.on; m.onclick=()=>{ fn(v-1); save(); }; p.onclick=()=>{ fn(v+1); save(); }; w.append(m,n,p); return w; };
    if(FUN.unlocked){ sec('🎉 歡樂模式');
      row('歡樂模式',sw(FUN.on,v=>{ funSet(v); },'歡樂模式'),'全車解放、撞人噴血、撞車爆炸、🚀 氮氣、唔扣生命之星（唔計正式成績）');
      if(FUN.on) B.append(el('p','set-warn','🎉 開咗：所有車款可以揀；揸車時右邊有 🚀 掣（鍵盤 Shift）。歡樂分 '+FUN.score.toLocaleString())); }
    sec('🔤 提示字體大小');
    { const cur=store.get('fontSz',0), segs=el('div','set-seg'); [['小','預設'],['中','大少少'],['大','最易睇']].forEach(([t,d],v)=>{ const b=el('button','set-segb'+(cur===v?' on':'')); b.append(el('b',null,t),el('small',null,d)); b.setAttribute('aria-pressed',cur===v);
        b.onclick=()=>{ store.set('fontSz',v); applyFontSz(); renderMenu('set'); }; segs.append(b); }); B.append(segs); }
    sec('🚶 行人');
    row('行人自動避開',sw(DODGE.on,v=>{ DODGE.on=v; store.set('dodge',v); },'行人自動避開'),DODGE.on?'開：撞埋去之前行人會自己跳開，唔會受傷，亦唔扣生命之星':'關：撞到行人會瞓喺地下，一陣後消失（會扣生命之星）');
    sec('🖼️ 畫面質素');
    { const cur=store.get('gfx',2), segs=el('div','set-seg'); [['標準','最順，舊手機都得'],['精細','欄杆、街道設施、霓虹招牌'],['超精細','再多招牌同細節，新手機用']].forEach(([t,d],v)=>{ const b=el('button','set-segb'+(cur===v?' on':'')); b.append(el('b',null,t),el('small',null,d)); b.setAttribute('aria-pressed',cur===v);
        b.onclick=()=>{ if(cur===v) return; store.set('gfx',v); store.set('openTab','set'); B.innerHTML='<p style="text-align:center;padding:30px 0">🖼️ 轉做「'+t+'」，重新載入地圖中……</p>'; setTimeout(()=>location.reload(),60); }; segs.append(b); });
      const r=el('div','set-row set-col'); const l=el('div','set-l'); l.append(el('b',null,'畫面細節'),el('small',null,'轉模式會重新載入地圖')); r.append(l,segs); B.append(r); }
    sec('🐾 城市動物');
    row('生成動物',sw(C.on,v=>C.on=v,'生成動物'),'行人路、河上同天空嘅動物');
    row('地上動物數量',step(C.ground,1,12,v=>C.ground=v,'地上動物數量'),'同一時間最多幾多隻（落雨減半）');
    row('鴨仔隊數',step(C.ducks,0,4,v=>C.ducks=v,'鴨仔隊數'),'河同湖上面，夜晚唔會出');
    const chips=el('div','set-chips'); [['cat','🐱 貓'],['dog','🐶 狗'],['pigeon','🕊️ 白鴿'],['sparrow','🐦 麻雀'],['cow','🐄 黃牛']].forEach(([k,t])=>{ const b=el('button','set-chip'+(C.types[k]?' on':''),t); b.disabled=!C.on; b.setAttribute('aria-pressed',C.types[k]); b.onclick=()=>{ C.types[k]=!C.types[k]; save(); }; chips.append(b); });
    row('出現邊啲動物',chips,'黃牛只會喺屯門郊區出現');
    sec('✈️ 天空');
    row('飛機',sw(C.plane&&C.on,v=>C.plane=v,'飛機'),'每一兩分鐘飛過一次');
    row('麻鷹／遊隼',sw(C.kite&&C.on,v=>C.kite=v,'麻鷹'),'日間晴天喺天上打圈、俯衝');
    if(C.ground>8) B.append(el('p','set-warn','⚠️ 數量好多時，舊款手機可能會慢少少。'));
    const rs=el('button','sec wide','還原預設'); rs.onclick=()=>{ ANI.setCfg(JSON.parse(JSON.stringify(ANI.def))); renderMenu('set'); }; B.append(rs);
    sec('🔐 PIN 及聲明');
    { const lg=el('button','sec wide','📜 顯示免責聲明'); lg.onclick=showLegal; B.append(lg);
      const pb=el('button','sec wide','🔒 返回 PIN 畫面'); let armed=false; pb.onclick=()=>{ if(!armed){ armed=true; pb.textContent='再撳一次確認（之後要重新輸入 PIN）'; setTimeout(()=>{ armed=false; pb.textContent='🔒 返回 PIN 畫面'; },4000); return; }
        try{ localStorage.removeItem('pinGate.ok'); }catch(e){} store.set('openTab','levels'); location.reload(); }; B.append(pb); }
    B.querySelectorAll('.set-row').forEach((r,i)=>{ if(i>1&&!C.on) r.classList.add('dim'); }); }
  if(tab==='livery'){ const tot=totalStars(), cur=(LIVERY.find(l=>l.id===store.get('livery','yellow'))||LIVERY[0]).id; B.append(el('p',null,'累積最佳生命之星數：'+tot+' 粒。儲夠星數就解鎖新車款，每款性能唔同：'));
    LIVERY.filter(l=>!l.hidden).forEach(L=>{ const lock=tot<L.need&&!unlockedAll()&&!FUN.on; const b=el('button','liv'+(L.id===cur?' on':'')); b.disabled=lock; const sw=el('span','sw'); sw.style.background=L.sw;
      const bar=n=>'●'.repeat(n)+'○'.repeat(5-n), sp=Math.max(1,Math.min(5,Math.round((L.vmax-20)/3.6))), ag=Math.max(1,Math.min(5,Math.round((L.steer-1.3)/0.29)));
      const t=el('div'); t.append(el('b',null,L.name+(L.id===cur?'（使用中）':'')),el('small',null,lock?' 🔒 需要 '+L.need+' 粒生命之星':' 已解鎖'),el('br'),el('small',null,'速度 '+bar(sp)+'　靈活 '+bar(ag)+'　'+(L.siren?'有警號':'冇警號')),el('br'),el('small',null,L.d)); b.append(sw,t); b.onclick=()=>{ applyLivery(L.id); renderMenu('livery'); }; B.append(b); }); }
}

/* ---------- 交通意外現場：青山公路（巴士同小巴相撞） ---------- */
LMK.crash=REGION!=='tm'?null:(()=>{ const E=nearestEdge(...RP(330,300),r=>r.name==='青山公路'); const ux=-E.nz, uz=E.nx; // 行車方向：現場喺左手邊
  const lo=laneOff(E.r), R=E.R, P=(a,b)=>[R[0]+ux*a+E.nx*b,R[1]+uz*a+E.nz*b];
  return {stop:P(-6,lo),patient:P(4,E.r.w/2+2),ux,uz,nx:E.nx,nz:E.nz,P,w:E.r.w}; })();
const SCN={meshes:[],statics:[]};
function staticVeh(m,x,z,a){ m.position.set(x,0.1,z); m.rotation.y=a; const o={m,stuck:true,road:null,pose:{x,z,a},id:800+SCN.statics.length}; cars.push(o); SCN.statics.push(o); return o; }
function setupScene(k,lv){ clearScene();
  if(k.id==='crash'){ const C0=LMK.crash, P=C0.P, base=Math.atan2(C0.ux,C0.uz);
    const bp=P(16,laneOff({t:'main',w:C0.w})); staticVeh(carModel('bus'),bp[0],bp[1],base+0.35);
    const mp=P(23,-1.5); staticVeh(carModel('minibus'),mp[0],mp[1],base-1.25);
    for(let i=0;i<14;i++){ const d=P(18+Math.random()*7,Math.random()*6-2); const g=add(new THREE.BoxGeometry(0.3+Math.random()*0.5,0.08,0.3+Math.random()*0.5),M([0xd8dde3,0x9aa1aa,0xffd23f][i%3]),scene,d[0],0.2,d[1],false); g.rotation.y=Math.random()*3; SCN.meshes.push(g); } // 碎片
    [P(4,C0.w/2-1),P(32,C0.w/2-1)].forEach(p=>{ const t=add(new THREE.ConeGeometry(0.45,0.9,3),M(0xff3b30),scene,p[0],0.6,p[1],false); SCN.meshes.push(t); }); // 警告三角
    for(let i=0;i<3;i++){ const pp=person('bystander'); const q=P(20+i*2.5,C0.w/2+2.5); pp.position.set(q[0],0.2,q[1]); pp.rotation.y=Math.random()*6; SCN.meshes.push(pp); } }
  if(k.id==='mass'){ const P0=LMK.plaza.patient; const col=[0xe8323c,0xffc21a,0x21b46b,0xffc21a,0x21b46b];
    for(let i=0;i<5;i++){ const lp=lyingPatient(); const x=P0[0]+Math.cos(i*1.3)*(4+i*1.2), z=P0[1]+Math.sin(i*1.3)*2.2; lp.position.set(x,0.3,z); lp.rotation.set(0,Math.random()*6,0);
      lp.userData.blanket.visible=false; lp.userData.p.position.set(0,0.5,1.2); lp.userData.p.rotation.set(-Math.PI/2,0,0);
      add(new THREE.BoxGeometry(0.5,0.05,0.35),new THREE.MeshBasicMaterial({color:col[i]}),lp,0,0.95,0.6,false); SCN.meshes.push(lp); }
    for(let i=0;i<4;i++){ const pp=person('bystander'); pp.position.set(P0[0]-6+i*3,0.2,P0[1]+3.5); pp.rotation.y=Math.random()*6; SCN.meshes.push(pp); } } }
function clearScene(){ SCN.meshes.forEach(m=>scene.remove(m)); SCN.meshes.length=0; SCN.statics.forEach(o=>{ scene.remove(o.m); const i=cars.indexOf(o); if(i>=0) cars.splice(i,1); }); SCN.statics.length=0; clearEscorts(); }

/* ---------- 大量傷者：其他救護車由救護站一齊出發 ---------- */
const ESC=[];
function clearEscorts(){ S.supQ=null; HELP.clear(); ESC.forEach(e=>{ if(e.parked){ const h=e.parked.home; e.m.position.set(h[0],0.34,h[1]); e.m.rotation.y=h[2]; e.m.visible=true; e.m.userData.blues.forEach(b=>b.material.emissive.setHex(0)); } else scene.remove(e.m); }); ESC.length=0; }
const ESC_NO=['A319','A167','A203','A256'];
function launchEscorts(n){ const R=S.escRoute; if(!R) return;
  // 車隊：先係門口兩架（A245、A272），再由車房出其他救護車；行靠近中線嗰邊，方便其他車靠邊讓路
  const units=[...PARKED.map(p=>({m:p.m,start:[p.home[0],p.home[1]],parked:p}))];
  for(let i=0;units.length<n;i++){ const m=ambulance(ESC_NO[i%ESC_NO.length]); m.userData.body.scale.setScalar(0.85); m.userData.pB.intensity=0; m.userData.pR.intensity=0; m.userData.pB.visible=m.userData.pR.visible=false; m.userData.len=6; m.visible=false; units.push({m,start:DEPOT.pos.slice()}); }
  units.slice(0,n).forEach((u,i)=>{ const stopAt=Math.max(20,R.len-11*(i+1)); const pts=[], cum=[];
    for(let j=0;j<R.pts.length;j++){ if(R.cum[j]<=stopAt){ pts.push(R.pts[j].slice()); cum.push(R.cum[j]); } else { const A=R.pts[j-1],B=R.pts[j],k=(stopAt-R.cum[j-1])/((R.cum[j]-R.cum[j-1])||1); pts.push([A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k]); cum.push(stopAt); break; } }
    for(let j=1;j<pts.length-1;j++){ const [ux,uz]=dirn(pts[j-1],pts[j+1]); pts[j]=[pts[j][0]-uz*1.6,pts[j][1]+ux*1.6]; } // 向中線靠 1.6 米
    pts[0]=u.start.slice(); for(let j=1;j<pts.length;j++) cum[j]=cum[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]);
    ESC.push({m:u.m,pts,cum,s:0,delay:1+i*3.2,v:0,pose:null,done:false,parked:u.parked}); });
  toast('🚑 救護車隊跟住你出發！'); }
/* 支援單位：交通意外 → 警車；危及生命 → 救護電單車；部分關卡 → 消防車（先遣急救員）。救護車出咗車房先喺後面出現，一齊去現場 */
const SUP={police:{nm:'👮 警車',tag:'👮 警車協助',arr:'👮 警察到場協助',sp:15,mk:()=>SKB.police(),len:6},
  moto:{nm:'🏍️ 救護電單車',tag:'🏍️ 救護電單車協助',arr:'🏍️ 救護電單車到場',sp:36,fast:true,mk:()=>SKB.moto(),len:2.4},
  fire:{nm:'🚒 消防車',tag:'🚒 先遣急救員（消防）',arr:'🚒 先遣急救員到場',sp:33,fast:true,mk:()=>SKB.fire(),len:6.8}};
function supTags(lv){ return (lv.support||[]).map(k=>SUP[k].tag); }
function launchSupport(list){ const R=S.route; if(!R||!list||!list.length) return; const c=S.car, fx=Math.sin(c.a), fz=Math.cos(c.a);
  let j0=1, bd=1e9; for(let j=1;j<R.pts.length;j++){ const A=R.pts[j-1],B=R.pts[j],dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; const k=Math.max(0,Math.min(1,((c.x-A[0])*dx+(c.z-A[1])*dz)/L2)); const d=(A[0]+dx*k-c.x)**2+(A[1]+dz*k-c.z)**2; if(d<bd){ bd=d; j0=j; } }   // 由救護車而家喺路線上嘅位置開始跟，唔會倒返轉頭
  list.forEach((k,i)=>{ const U=SUP[k]; let back=16+i*13; while(back>6&&!(cellAt(c.x-fx*back,c.z-fz*back)&1)) back-=2;
    const start=[c.x-fx*back,c.z-fz*back], stopAt=Math.max(15,R.len-13-i*10), pts=[start], cum=[0];
    for(let j=j0;j<R.pts.length;j++){ if(R.cum[j]<=stopAt) pts.push(R.pts[j].slice()); else { const A=R.pts[j-1],B=R.pts[j],q=(stopAt-R.cum[j-1])/((R.cum[j]-R.cum[j-1])||1); pts.push([A[0]+(B[0]-A[0])*q,A[1]+(B[1]-A[1])*q]); break; } }
    for(let j=1;j<pts.length;j++) cum.push(cum[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]));
    const m=U.mk(); m.userData.len=U.len; m.visible=i===0; m.position.set(start[0],0,start[1]); scene.add(m);
    ESC.push({kind:k,m,pts,cum,s:0,delay:i*0.8,v:Math.max(0,S.car.v),pose:null,done:false,vmax:U.sp,arrive:U.arr,follow:!U.fast,idx:i}); });   // 警車跟救護車同速；消防車、救護電單車快過救護車，會爬頭先到
  toast(list.map(k=>SUP[k].nm).join('、')+' 同你一齊出發！'); }
function queueSupport(list,armed){ S.supQ=list&&list.length?{list,armed:!!armed,t:1}:null; }   // 救護車離開救護站大約 1 秒後，支援單位喺後面出現
function escortTick(dt,t){ const on=Math.floor(t*5)%2===0;
  if(S.supQ&&S.mode==='drive'){ const q=S.supQ; if(!q.armed&&Math.hypot(S.car.x-DEPOT.pos[0],S.car.z-DEPOT.pos[1])>16) q.armed=true; if(q.armed&&(q.t-=dt)<=0){ S.supQ=null; launchSupport(q.list); } }
  for(const e of ESC){ if(e.static) continue; e.m.userData.blues.forEach((b,i)=>b.material.emissive.setHex((i%2===0)===on?(b.userData.on||0x1550ff):0));
    if(e.delay>0){ e.delay-=dt; if(e.delay<=0){ e.m.visible=true; } else continue; }
    if(e.done){ (e.m.userData.wheels||[]).forEach(()=>{}); }
    const L=e.cum[e.cum.length-1]; let target=e.done?0:(e.vmax||14);
    if(e.follow&&!e.done&&S.step===1&&e.pose){ const c=S.car, dx=c.x-e.pose.x, dz=c.z-e.pose.z, ah=dx*Math.sin(e.pose.a)+dz*Math.cos(e.pose.a), gap=Math.hypot(dx,dz), want=11+e.idx*10;   // 跟救護車同樣速度，保持車距
      target=ah>0?Math.max(0,Math.min(34,Math.abs(c.v)+(gap-want)*0.9)):Math.min(target,Math.abs(c.v)*0.6); }
    if(L-e.s<12) target=Math.min(target,(L-e.s)*1.2);
    // 行車線：e.lat 係向對面線偏移幾多米（0＝自己線）。前面有慢車就睇對面線清唔清，清就過對面線超車；唔清就停，唔會穿過其他車
    const at=s=>{ let q=1; while(q<e.cum.length-1&&e.cum[q]<s) q++; const A=e.pts[q-1],B=e.pts[q],k=(s-e.cum[q-1])/((e.cum[q]-e.cum[q-1])||1); return [A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k,Math.atan2(B[0]-A[0],B[1]-A[1])]; };
    const [bx,bz,ba]=at(e.s), ux=Math.sin(ba), uz=Math.cos(ba), ox=-uz, oz=ux;   // 自己線中心、前進方向、對面線方向
    if(!e.oo||(e.ooT=(e.ooT||0)-dt)<0){ e.ooT=0.5; let best=null,bd=1e9; for(const r of MAP.roads){ const P=NODES[r.n[0]],Q=NODES[r.n[1]],dx=Q[0]-P[0],dz=Q[1]-P[1],L2=dx*dx+dz*dz||1; let k=((bx-P[0])*dx+(bz-P[1])*dz)/L2; k=Math.max(0,Math.min(1,k)); const d=(P[0]+dx*k-bx)**2+(P[1]+dz*k-bz)**2; if(d<bd){ bd=d; best=r; } } e.oo=best?Math.max(5,laneOff(best)*2-1.6):6; }
    e.lat=e.lat||0; e.latT=e.latT||0; let block=99, oppAhead=99, ownBack=false, oppBusy=false, blockEsc=false;
    if(!e.done) for(const o of [...cars,...trams,{pose:{x:S.car.x,z:S.car.z},me:1},...ESC]){ if(o===e||!o.pose||(o.m&&!o.m.visible&&!o.me)) continue; const qx=o.pose.x-bx, qz=o.pose.z-bz, ah=qx*ux+qz*uz, lo=qx*ox+qz*oz; if(ah<-12||ah>45) continue;
      const half=((o.m&&o.m.userData.len)||4.4)/2+((e.m.userData.len||6)/2);
      if(Math.abs(lo-e.lat)<2.4&&ah>0&&ah-half<block){ block=ah-half; blockEsc=!!(o.follow||o.me); }                       // 前面同一條線
      if(Math.abs(lo)<2.4&&ah>-half-3&&ah<half+6) ownBack=true;                               // 自己線（返嚟用）有車
      if(Math.abs(lo-e.oo)<2.8){ if(ah>-half-4&&ah<half+30) oppBusy=true; if(ah>0) oppAhead=Math.min(oppAhead,ah-half); } }
    const left=L-e.s;
    if(e.latT===0&&block<30&&left>34&&!oppBusy&&!(e.follow&&blockEsc)) e.latT=e.oo;   // 車隊唔會超前面嘅救護車／支援車                                     // 出去對面線超車
    else if(e.latT>0&&(!ownBack||left<20)&&block>6) e.latT=0;                                     // 超咗車：返自己線
    else if(e.latT>0&&oppAhead<16&&!ownBack) e.latT=0;                                            // 對面有車嚟：避返入去
    if(block<16) target=Math.min(target,Math.max(0,(block-3)*1.2)); if(block<4) e.v=0;            // 太近就即刻停，唔會撞埋去
    if(e.latT>0&&oppAhead<10) { target=0; if(oppAhead<4) e.v=0; }
    e.v+=(target-e.v)*Math.min(1,dt*2); e.s=Math.min(L,e.s+e.v*dt); if(L-e.s<0.3&&!e.done){ e.done=true; if(e.arrive) toast(e.arrive); }
    const dl=e.latT-e.lat, step=Math.min(Math.abs(dl),dt*Math.max(3,e.v*0.5)); e.lat+=Math.sign(dl)*step;
    const [x0,z0,a]=at(e.s), x=x0+(-Math.cos(a))*e.lat, z=z0+Math.sin(a)*e.lat, steer=Math.atan2(Math.sign(dl)*step/Math.max(dt,1e-3),Math.max(2,e.v))*0.6;
    const want=a-steer, prevA=e.pose?e.pose.a:want; const na=prevA+(((want-prevA)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*5);
    e.pose={x,z,a:na}; groundPose(e.m,x,0.12,z,na,e.m.userData.len||6); (e.m.userData.wheels||[]).forEach(w=>w.rotation.x+=e.v*dt/0.6); } }

/* ---------- 提示字體大小（小／中／大）：放大字幕、提示、派單、無線電、教學、任務卡同答題 ---------- */
{ const st=document.createElement('style'); st.textContent='#cap,#toast,#callBox,#radio,#coach,#hudWrap .top .card,#rMis,#rDisp,#quiz .panel,#stabBox{zoom:var(--fz,1)}'; document.head.append(st); }
function applyFontSz(){ const v=store.get('fontSz',0); document.documentElement.style.setProperty('--fz',[1,1.2,1.4][v]||1); }
applyFontSz();
/* ---------- 免責聲明（PIN 畫面嗰份，喺設定都睇得返） ---------- */
function showLegal(){ let d=document.getElementById('legalBox'); if(!d){ d=document.createElement('div'); d.id='legalBox';
    d.style.cssText='position:fixed;inset:0;z-index:100;background:#0b0f16e8;display:flex;align-items:center;justify-content:center;padding:16px';
    d.innerHTML='<div style="width:min(520px,94vw);max-height:88vh;overflow:auto;background:#16212c;color:#c9d3de;border:1px solid #2c3a49;border-radius:14px;padding:14px 16px;font-size:13px;line-height:1.6;text-align:left"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="font-size:16px;color:#fff">免責聲明 Disclaimer</b><span style="margin-left:auto;display:flex;gap:4px"><button data-l="zh" class="lgt">中文</button><button data-l="en" class="lgt">English</button><button id="lgX" aria-label="關閉">✕</button></span></div><div id="lgZh">'+(window.LEGAL_ZH||'')+'</div><div id="lgEn" style="display:none">'+(window.LEGAL_EN||'')+'</div></div><style>#legalBox p{margin:0 0 10px}#legalBox a{color:#8fc3ff}#legalBox button{font:inherit;font-size:12px;padding:4px 10px;border-radius:8px;border:1px solid #3a4756;background:transparent;color:#fff}#legalBox .lgt.on{background:#e23b3b}</style>';
    document.body.append(d);
    const pick=l=>{ d.querySelector('#lgZh').style.display=l==='zh'?'':'none'; d.querySelector('#lgEn').style.display=l==='en'?'':'none'; d.querySelectorAll('.lgt').forEach(b=>b.classList.toggle('on',b.dataset.l===l)); };
    d.querySelectorAll('.lgt').forEach(b=>b.onclick=()=>pick(b.dataset.l)); pick('zh');
    d.querySelector('#lgX').onclick=()=>d.style.display='none'; d.addEventListener('click',e=>{ if(e.target===d) d.style.display='none'; }); }
  d.style.display='flex'; }
/* ---------- 隱藏解鎖：撳左上角 A188 五下 ---------- */
let badgeN=0, badgeT=0;
document.querySelector('#menu .badge').addEventListener('click',()=>{ const now=Date.now(); if(now-badgeT>4000) badgeN=0; badgeT=now; badgeN++;
  if(badgeN>=5){ badgeN=0; store.set('unlockAll',1); S.unlockMsg=true; renderMenu(S.tab); } });
const unlockedAll=()=>!!store.get('unlockAll',0);

/* ---------- 防撞探測：前面（倒車時後面）有人、車或者障礙物就自動煞車 ---------- */
S.aeb=store.get('aeb',true);
const aebFan=(()=>{ const g=new THREE.PlaneGeometry(2.6,1); g.rotateX(-Math.PI/2); g.translate(0,0,0.5);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x22e06a,transparent:true,opacity:0.22,depthWrite:false})); m.renderOrder=3; scene.add(m); m.visible=false; return m; })();
function aebSense(c,dir,look){ const fx=Math.sin(c.a)*dir, fz=Math.cos(c.a)*dir, rx=fz, rz=-fx; let best=Infinity;
  const test=(x,z,hw)=>{ const qx=x-c.x, qz=z-c.z, ah=qx*fx+qz*fz, lat=Math.abs(qx*rx+qz*rz); if(ah>VSPEC.nose-0.4&&ah<look+VSPEC.nose&&lat<1.3*VSPEC.kw+hw) best=Math.min(best,ah-VSPEC.nose); };
  peds.forEach(p=>{ if(p.pos) test(p.pos[0],p.pos[1],0.5); });
  [...cars,...trams,...ESC].forEach(o=>{ if(!o.pose) return; const half=(o.m.userData.len||4.4)/2, sa=Math.sin(o.pose.a), ca=Math.cos(o.pose.a);
    for(let q=-half;q<=half;q+=1.5) test(o.pose.x+sa*q,o.pose.z+ca*q,1.2); });
  for(let d=VSPEC.nose+0.2;d<look+VSPEC.nose;d+=1) for(const l0 of [-1.1,0,1.1]){ const l=l0*VSPEC.kw; if(cellAt(c.x+fx*d+rx*l,c.z+fz*d+rz*l)&6){ best=Math.min(best,d-VSPEC.nose); break; } }
  return best; }
function aebTick(dt){ const c=S.car; aebFan.visible=false; if(!S.aeb||S.mode!=='drive'||!S.leftDepot) return;
  const dir=c.v<-0.3||(S.hold.B&&c.v<=0.5)?-1:1, v=Math.abs(c.v), look=Math.max(6,v*v/(2*30)+6);
  const d=aebSense(c,dir,look); const hit=d<look;
  aebFan.visible=true; { const ax=c.x+Math.sin(c.a)*VSPEC.nose*dir, az=c.z+Math.cos(c.a)*VSPEC.nose*dir; aebFan.position.set(ax,0.32+ELEV(ax,az),az); } aebFan.rotation.y=c.a+(dir<0?Math.PI:0); aebFan.scale.set(1,1,Math.min(look,hit?Math.max(0.5,d):look));
  aebFan.material.color.setHex(hit?0xff3b30:0x22e06a);
  if(hit&&((dir>0&&c.v>0)||(dir<0&&c.v<0)||v<0.3)){ // 自動煞車；太近就唔准再向前
    if(dir>0){ c.v=Math.max(0,c.v-(d<3?80:48)*dt); if(d<2.5&&S.hold.G) c.v=0; } else { c.v=Math.min(0,c.v+(d<3?80:48)*dt); if(d<2.5&&S.hold.B) c.v=0; }
    if(v>2&&(!S.aebT||performance.now()-S.aebT>2500)){ S.aebT=performance.now(); toast('⚠️ 偵測到障礙，自動煞車'); } } }
function aebShow(){ $('bAEB').textContent='防撞 '+(S.aeb?'開':'關'); $('bAEB').setAttribute('aria-pressed',S.aeb); }
$('bAEB').onclick=()=>{ S.aeb=!S.aeb; if(S.gm==='ems') store.set('aeb',S.aeb); $('bAEB').textContent='防撞 '+(S.aeb?'開':'關'); $('bAEB').setAttribute('aria-pressed',S.aeb); };
$('bAEB').textContent='防撞 '+(S.aeb?'開':'關'); $('bAEB').setAttribute('aria-pressed',S.aeb);

/* ================= 模式 ①：的士接客（Crazy Taxi 玩法） =================
   60 秒起步，路邊有 3 位乘客等車：橙＝近、黃＝中、綠＝遠。
   停喺乘客旁邊就上車，送到目的地收錢＋加時，提早送到有貼士。冇罰則，撞到只會減速。 */
const TX={ cls:{ o:{name:'橙',dist:'近程',col:0xff8c1a,css:'#ff8c1a',pay:10,add:5,r:[90,260]},
               y:{name:'黃',dist:'中程',col:0xffd21a,css:'#e6b800',pay:25,add:8,r:[260,520]},
               g:{name:'綠',dist:'遠程',col:0x2ecc40,css:'#22a83a',pay:50,add:12,r:[520,1400]} },
  wait:[], rider:null, money:0, done:0, tLeft:60, prevLiv:null, spots:null, lastNear:-1, streak:0, nm:0, nmMoney:0 };
// 乘客對白
const TXSAY={ up:['唔該，趕時間呀！','司機，快啲呀！','去呢度，唔該晒！','我遲到喇，快快快！'],
  slow:['快啲呀司機！','咁慢嘅？','我趕時間㗎！','你揸緊龜呀？'], wow:['嘩！好刺激！','好嘢！夠快！','司機你好勁！','好險呀！'],
  thanks:['多謝司機！','好快！唔使找！','正！下次再搭！'], angry:['唔坐喇！','咁慢我自己行好過！'] };
const txPick=a=>a[Math.random()*a.length|0];
function txSay(txt){ document.querySelectorAll('.txsay').forEach(e=>e.remove()); const d=document.createElement('div'); d.className='txsay'; d.textContent=txt; document.body.appendChild(d); setTimeout(()=>d.remove(),2300); }
const txMult=()=>TX.streak>=4?3:TX.streak>=2?2:1;
function txCombo(){ const e=$('txCombo'), m=txMult(); if(m>1&&S.gm==='taxi'){ e.style.display='block'; e.textContent='🔥 連送 ×'+m; } else e.style.display='none'; }
// 路邊上落客位：所有街道（唔包高架元朗公路、橋）每段中間兩邊
function taxiSpots(){ if(TX.spots) return TX.spots; const out=[];
  MAP.roads.forEach(r=>{ if(r.bridge||r.elev) return; const A=NODES[r.n[0]],B=NODES[r.n[1]]; const L=Math.hypot(B[0]-A[0],B[1]-A[1]); if(L<30) return;
    const ux=(B[0]-A[0])/L, uz=(B[1]-A[1])/L; for(const sd of [-1,1]){ const o=r.w/2+1.6; const x=(A[0]+B[0])/2+uz*o*sd, z=(A[1]+B[1])/2-ux*o*sd;
      const rx=(A[0]+B[0])/2+uz*(r.w/4)*sd, rz=(A[1]+B[1])/2-ux*(r.w/4)*sd; out.push({p:[x,z],road:[rx,rz],face:Math.atan2(-uz*sd,ux*sd)}); } });
  if(NEON) NEON.rail.cutPts(out.map(s=>s.p),3.6);   // 乘客上落位唔好有欄杆
  return TX.spots=out; }
function txBeep(f,d){ try{ ensureAudio(); if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type='sine'; o.frequency.value=f; g.gain.value=0.05; g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+d+0.12); o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime+d+0.14); }catch(e){} }
const txD=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function txMarker(col){ const g=new THREE.Group(); scene.add(g);
  const pm=person('bystander'); pm.scale.setScalar(0.9); g.add(pm);
  const ringM=new THREE.Mesh(new THREE.TorusGeometry(2.6,0.28,8,32),new THREE.MeshBasicMaterial({color:col})); ringM.rotation.x=Math.PI/2; ringM.position.y=0.3; g.add(ringM);
  const col3=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,26,12,1,true),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.35,depthWrite:false,side:THREE.DoubleSide})); col3.position.y=13; g.add(col3);
  const dia=new THREE.Mesh(new THREE.OctahedronGeometry(0.9),new THREE.MeshBasicMaterial({color:col})); dia.position.y=4.6; g.add(dia); g.userData={dia,pm}; return g; }
function txDrop(m){ scene.remove(m); m.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); }
// 補足 3 位等車乘客（每種顏色一位），喺車附近 60–260 米
function txFill(){ const c=S.car, spots=taxiSpots();
  while(TX.wait.length<2){ const have=new Set(TX.wait.map(w=>w.k)); const free=['o','y','g'].filter(k=>!have.has(k)); const k=free[Math.random()*free.length|0];
    let cand=spots.filter(s=>{ const d=txD(s.p,[c.x,c.z]); return d>25&&d<130&&!TX.wait.some(w=>txD(w.s.p,s.p)<30); });
    if(!cand.length) cand=spots.filter(s=>{ const d=txD(s.p,[c.x,c.z]); return d>25&&d<260; });
    if(!cand.length) cand=spots.filter(s=>txD(s.p,[c.x,c.z])<420);
    const s=cand[Math.random()*cand.length|0]; if(!s) break; const m=txMarker(TX.cls[k].col); m.position.set(s.p[0],ELEV(s.p[0],s.p[1]),s.p[1]); m.userData.pm.rotation.y=s.face;
    TX.wait.push({k,s,m}); } }
function txPickDest(k,from){ const R=TX.cls[k].r, spots=taxiSpots();
  let cand=spots.filter(s=>{ const d=txD(s.p,from); return d>=R[0]&&d<=R[1]; });
  if(!cand.length) cand=spots.filter(s=>txD(s.p,from)>R[0]*0.6);
  return cand[Math.random()*cand.length|0]||spots[0]; }
function txSetNav(){ const c=S.car; let tg;
  if(TX.rider) tg=TX.rider.dest.road;
  else { let best=null,bd=1e9; TX.wait.forEach(w=>{ const d=txD(w.s.road,[c.x,c.z]); if(d<bd){ bd=d; best=w; } }); if(!best) return; tg=best.s.road; TX.lastNear=best; }
  setTarget(tg); refreshRoute(true); const col=TX.rider?TX.cls[TX.rider.k].col:TX.lastNear?TX.cls[TX.lastNear.k].col:0xff7a1a;
  ring.material.color.setHex(col); ring.material.emissive&&ring.material.emissive.setHex(0x222222); beacon.material.color.setHex(col); }
function txHud(){ const r=TX.rider; hud('💰 $'+TX.money,' · '+(r?'送'+TX.cls[r.k].name+'色乘客（'+TX.cls[r.k].dist+'）':'接客：揀一位乘客')+' · 已送 '+TX.done+' 位'); }
function startTaxi(){ ensureAudio(); if(S.gm==='chase'||S.gm==='free') chModeExit(); sirenSet(false); stopFireworks&&stopFireworks();
  if(S.gm!=='taxi') TX.prevLiv=store.get('livery','yellow'); S.gm='taxi'; applyLivery('taxi'); store.set('livery',TX.prevLiv);
  TX.wait.forEach(w=>txDrop(w.m)); TX.wait=[]; TX.rider=null; TX.money=0; TX.done=0; TX.tLeft=60; TX.lastNear=null; TX.flash=0; TX.streak=0; TX.nm=0; TX.nmMoney=0; TX.lastDrop=performance.now()/1000; txCombo(); $('txPat').style.display='none';
  S.level={id:'TAXI',limit:9,tod:'day'}; S.kase={id:'taxi',title:'的士接客',tips:[],steps:[],loc:null};
  resetActors(); setTOD('day'); clearEvents();
  // 隨機喺屯門市區一條街開始
  const st=taxiSpots().filter(s=>s.p[0]<240&&s.p[1]>-440); const s0=st[Math.random()*st.length|0];
  Object.assign(S.car,{x:s0.road[0],z:s0.road[1],a:s0.face+Math.PI/2,v:0}); S.camYaw=S.car.a;
  Object.assign(S,{mode:'drive',step:'taxi',leftDepot:true,lives:5,collided:false,redRun:false,inX:-1,quizOpen:false,lastHit:-9,t0:performance.now()/1000});
  S.spawnFree=true; for(let n=0;n<22;n++){ const c={m:carModel(['taxi','car','bus','car','minibus','taxi','car'][n%7])}; if(placeCar(c,S.car.x,S.car.z)) cars.push(c); else dropModel(c.m); }
  for(let n=0;n<PED_N;n++){ const p={m:pedModel()}; if(placePed(p,S.car.x,S.car.z)) peds.push(p); else scene.remove(p.m); } S.spawnFree=false;
  S.aeb=false; aebShow(); $('lives').style.display='none'; $('txBig').style.display='block'; $('txBig').textContent='60'; document.body.classList.add('taxi'); show('menu',false); show('result',false); show('over',false); show('hudWrap',true); show('stabBox',false);
  txFill(); txSetNav(); txHud(); caption('🚕 60 秒內接最多客！停喺有顏色光柱嘅乘客旁邊就上車'); setTimeout(()=>{ if(S.gm==='taxi'&&S.mode==='drive') caption(null); },3500);
  $('hTime').textContent=fmt(TX.tLeft); }
function txFloat(txt,css){ const d=document.createElement('div'); d.className='txpop'; d.textContent=txt; d.style.color=css; document.body.appendChild(d); setTimeout(()=>d.remove(),1600); }
function taxiTick(dt,d){ const c=S.car;
  TX.tLeft-=dt; const el=$('hTime'); el.textContent=fmt(Math.max(0,TX.tLeft)); el.classList.toggle('warn',TX.tLeft<10);
  const bc=$('txBig'), sec=Math.max(0,Math.ceil(TX.tLeft)); if(bc.textContent!==String(sec)){ bc.textContent=sec; bc.classList.toggle('warn',TX.tLeft<10); if(TX.tLeft<10){ bc.classList.remove('tick'); void bc.offsetWidth; bc.classList.add('tick'); } }
  const now=performance.now()/1000; TX.wait.forEach((w,i)=>{ w.m.userData.dia.rotation.y=now*2; w.m.userData.dia.position.y=4.6+Math.sin(now*3+i)*0.3; });
  pedFlyTick(dt);
  // 擦身而過：高速好近咁擦過其他車
  if(Math.abs(c.v)>16&&now-(S.lastHit||-9)>1.2){ for(const k of cars){ if(!k.pose) continue; const dx=k.pose.x-c.x, dz=k.pose.z-c.z, d2=dx*dx+dz*dz; if(d2>64) continue;
      const half=(k.m.userData.len||4)/2, kx=Math.sin(k.pose.a), kz=Math.cos(k.pose.a); const pr=Math.max(-half,Math.min(half,(c.x-k.pose.x)*kx+(c.z-k.pose.z)*kz)); const dd=Math.hypot(k.pose.x+kx*pr-c.x,k.pose.z+kz*pr-c.z);
      if(dd>3.3&&dd<5.2&&now-(k.nmT||0)>3){ k.nmT=now; TX.money+=2; TX.nm++; TX.nmMoney+=2; txFloat('好險！ +$2','#1f8fff'); txBeep(1560,0.05); if(TX.rider&&Math.random()<0.35) txSay(txPick(TXSAY.wow)); txHud(); } } }
  if(TX.tLeft<=0){ taxiEnd(); return; }
  if(!TX.rider){ // 上車：慢速經過任何一位乘客旁邊
    for(let i=0;i<TX.wait.length;i++){ const w=TX.wait[i]; if(txD(w.s.p,[c.x,c.z])<9&&Math.abs(c.v)<6){
      TX.wait.splice(i,1); txDrop(w.m); const dest=txPickDest(w.k,w.s.p); TX.rider={k:w.k,dest,t0:now};
      txSetNav(); const exp=(S.route?S.route.len:txD(dest.p,w.s.p))/17+6; TX.rider.exp=exp; txHud();
      TX.rider.pat=exp*1.8+6; TX.rider.slowSaid=0; $('txPat').style.display='block'; txSay(txPick(TXSAY.up)); txBeep(880,0.08); break; } }
    if(TX.streak>0&&now-TX.lastDrop>15){ TX.streak=0; txCombo(); toast('連送中斷'); }
    // 每秒睇吓邊位最近
    TX.navT=(TX.navT||0)+dt; if(TX.navT>1){ TX.navT=0; let best=null,bd=1e9; TX.wait.forEach(w=>{ const dd=txD(w.s.road,[c.x,c.z]); if(dd<bd){ bd=dd; best=w; } }); if(best&&best!==TX.lastNear) txSetNav();
      if(TX.wait.some(w=>txD(w.s.p,[c.x,c.z])>320)){ TX.wait.filter(w=>txD(w.s.p,[c.x,c.z])>320).forEach(w=>txDrop(w.m)); TX.wait=TX.wait.filter(w=>txD(w.s.p,[c.x,c.z])<=320); txFill(); txSetNav(); } }
  } else { const R=TX.rider, used=now-R.t0, left=1-used/R.pat; $('txPat').firstChild.style.width=Math.max(0,left*100)+'%'; $('txPat').firstChild.style.background=left>0.5?'#2ecc40':left>0.25?'#ffb020':'#e8323c';
    if(Math.abs(c.v)<4&&used>4&&now-R.slowSaid>6){ R.slowSaid=now; txSay(txPick(TXSAY.slow)); }
    if(left<=0){ txSay(txPick(TXSAY.angry)); toast('乘客嬲到落車走咗！'); TX.rider=null; TX.streak=0; txCombo(); $('txPat').style.display='none'; txBeep(220,0.2); TX.lastDrop=now; txFill(); txSetNav(); txHud(); return; }
  }
  if(TX.rider&&txD(TX.rider.dest.p,[c.x,c.z])<10&&Math.abs(c.v)<6){ // 落車收錢
    const K=TX.cls[TX.rider.k], used=now-TX.rider.t0, fast=used<TX.rider.exp, tip=fast?Math.round(Math.min(15,(TX.rider.exp-used)*0.8)):0;
    TX.streak=fast?TX.streak+1:0; const mult=txMult(); TX.lastDrop=now; txCombo(); $('txPat').style.display='none';
    TX.money+=(K.pay+tip)*mult; TX.tLeft+=K.add; { const bc=$('txBig'); bc.classList.remove('plus'); void bc.offsetWidth; bc.classList.add('plus'); } TX.done++; TX.rider=null; txSay(txPick(TXSAY.thanks));
    txFloat('+$'+(K.pay+tip)*mult+(mult>1?' (×'+mult+')':'')+'   +'+K.add+' 秒',K.css); txBeep(1320,0.1);
    txFill(); txSetNav(); txHud(); }
}
function txFireN(m){ return m>=300?5:m>=200?4:m>=120?3:m>=60?2:m>0?1:0; }
function taxiEnd(){ $('txCombo').style.display='none'; $('txPat').style.display='none'; $('txBig').style.display='none'; document.body.classList.remove('taxi'); S.mode='result'; caption(null); $('rTitle').textContent='⏰ 收工！'; TX.wait.forEach(w=>txDrop(w.m)); TX.wait=[]; ring.visible=beacon.visible=arrow.visible=false;
  const best=store.get('taxiBest',0), nb=TX.money>best; if(nb) store.set('taxiBest',TX.money);
  $('rStars').textContent='💰 $'+TX.money; $('rTime').textContent='送咗 '+TX.done+' 位乘客 · 擦身而過 '+TX.nm+' 次（$'+TX.nmMoney+'）';
  $('rNote').innerHTML=nb&&TX.money>0?'🎉 新紀錄！':'最高紀錄：$'+Math.max(best,TX.money);
  $('rAch').innerHTML=''; $('rTips').innerHTML='<small>橙＝近程 $10 +5 秒 · 黃＝中程 $25 +8 秒 · 綠＝遠程 $50 +12 秒 · 提早送到有貼士</small>'; $('rNext').style.display='none';
  S.stars=TX.money; S.tHosp=0; $('rName').value=getName(); $('rSave').disabled=false; $('rSave').textContent='儲存到排行榜';
  show('result',true); show('hudWrap',false); fireworks(txFireN(TX.money)); }
function taxiExit(){ S.aeb=store.get('aeb',true); aebShow(); $('txCombo').style.display='none'; $('txPat').style.display='none'; $('txBig').style.display='none'; document.body.classList.remove('taxi'); TX.wait.forEach(w=>txDrop(w.m)); TX.wait=[]; TX.rider=null; if(S.gm==='taxi'){ S.gm='ems'; applyLivery(TX.prevLiv||'yellow'); } $('lives').style.display='';
  ring.material.color.setHex(0xff7a1a); beacon.material.color.setHex(0xff7a1a); }
/* ---------- 撞到行人：卡通彈開、轉幾轉、再起身（新模式用） ---------- */
function pedFly(p,c){ if(p.mode==='fly') return; const sp=Math.max(6,Math.abs(c.v)); const a=Math.atan2(p.pos[0]-c.x,p.pos[1]-c.z);
  p.fly={vx:Math.sin(a)*sp*0.55+Math.sin(c.a)*sp*0.3,vz:Math.cos(a)*sp*0.55+Math.cos(c.a)*sp*0.3,vy:7+sp*0.25,y:0,spin:(Math.random()<0.5?-1:1)*(8+sp*0.3),t:0,base:ELEV(p.pos[0],p.pos[1])};
  p.prevMode=p.mode; p.mode='fly'; c.v*=0.85; txBeep(520,0.06); }
function pedFlyTick(dt){ for(const p of peds){ if(p.mode!=='fly') continue; const f=p.fly; f.t+=dt;
    if(f.y>0||f.vy>0){ f.vy-=22*dt; f.y=Math.max(0,f.y+f.vy*dt); p.pos=[p.pos[0]+f.vx*dt,p.pos[1]+f.vz*dt]; p.m.rotation.x+=f.spin*dt; if(f.y===0&&f.vy<0){ f.vy=f.vy<-6?-f.vy*0.35:0; f.vx*=0.5; f.vz*=0.5; } }
    else { f.vx*=0.8; f.vz*=0.8; p.m.rotation.x=-Math.PI/2*Math.min(1,(1.6-f.t)>0?1:0); if(p.funPool&&f.t>0.5){ p.funPool=false; bloodPool(p.pos[0],p.pos[1],f.base); } }   // 歡樂模式：倒地後血泊慢慢擴大
    if(f.t>1.6){ if(FUN.on||!DODGE.on){ p.m.rotation.set(-Math.PI/2,p.m.rotation.y,0); p.mode='down'; p.fly=null; if(!FUN.on) p.downT=2; } else { p.m.rotation.x=0; p.m.rotation.z=0; p.mode='idle'; p.fly=null; } }
    p.m.position.set(p.pos[0],f.base+(f.y||0),p.pos[1]); } }
window.__TX=TX;

/* ================= 模式 ②：追逐模式（逃避警車） =================
   用「車款」揀咗嘅車，喺隨機地點開始。警車開住警號追你，時間越耐警車同路障越多。
   撞到警車或者路障扣一粒生命之星，扣晒就被捕；撐夠 60 秒就成功逃脫。撞到人唔扣分（卡通彈開）。 */
const CH={ cops:[], blocks:[], tLeft:60, t:0, hitT:-9, sir:null, nextBlock:6 };
function chModeExit(){ if(typeof taxiExit==='function'&&S.gm==='taxi') taxiExit(); if(S.gm==='chase') chaseExit(); if(S.gm==='free') freeExit(); if(S.gm==='cpr') cprExit(); }
function chSpot(minD,maxD,ahead){ const c=S.car, fx=Math.sin(c.a), fz=Math.cos(c.a);
  let cand=taxiSpots().filter(s=>{ const dx=s.road[0]-c.x, dz=s.road[1]-c.z, d=Math.hypot(dx,dz); if(d<minD||d>maxD) return false;
    if(ahead!=null&&(dx*fx+dz*fz)/d*ahead<0.2) return false; return !inView(s.road[0],s.road[1],6); });
  if(!cand.length) cand=taxiSpots().filter(s=>{ const d=Math.hypot(s.road[0]-c.x,s.road[1]-c.z); return d>minD&&d<maxD*1.6&&!inView(s.road[0],s.road[1],6); });
  return cand[Math.random()*cand.length|0]; }
function chAddCop(){ const s=chSpot(90,170,-1); if(!s) return; const m=SKB.police(); scene.add(m); m.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  const cop={m,x:s.road[0],z:s.road[1],a:Math.atan2(S.car.x-s.road[0],S.car.z-s.road[1]),v:0,path:null,pT:Math.random(),stuck:0,back:0}; CH.cops.push(cop); }
function chDrop(m){ scene.remove(m); m.traverse(o=>{ if(o.geometry&&!o.geometry.userData.shared) o.geometry.dispose(); }); }
// 路障：攔住大約七成路面，留一條窄位
function chAddBlock(){ const s=chSpot(70,180,1); if(!s) return; const r=MAP.roads.reduce((b,q)=>{ const A=NODES[q.n[0]],B=NODES[q.n[1]]; const d=Math.abs((B[0]-A[0])*(A[1]-s.road[1])-(A[0]-s.road[0])*(B[1]-A[1]))/(Math.hypot(B[0]-A[0],B[1]-A[1])||1); return !b||d<b.d?{q,d}:b; },null).q;
  const A=NODES[r.n[0]],B=NODES[r.n[1]]; const [ux,uz]=dirn(A,B); const nx=uz, nz=-ux; const mx=(A[0]+B[0])/2, mz=(A[1]+B[1])/2, half=r.w/2, gapSide=Math.random()<0.5?-1:1;
  const g=new THREE.Group(); g.position.set(mx,ELEV(mx,mz),mz); g.rotation.y=Math.atan2(ux,uz); scene.add(g); const circ=[];
  const bar=vtex('chbar',128,32,(c,W,H)=>{ for(let i=0;i<8;i++){ c.fillStyle=i%2?'#ffffff':'#e8202a'; c.beginPath(); c.moveTo(i*20-10,H); c.lineTo(i*20+6,0); c.lineTo(i*20+22,0); c.lineTo(i*20+6,H); c.fill(); } });
  for(let o=-half+1.2;o<=half-1.2;o+=2.4){ if(o*gapSide>half*0.4) continue; const b=new THREE.Group(); b.position.set(o,0,0); g.add(b);
    add(new THREE.BoxGeometry(2.2,0.5,0.25),bar,b,0,1.0,0,true); [-0.9,0.9].forEach(x=>add(new THREE.BoxGeometry(0.12,1.1,0.12),M(0x9aa1ab),b,x,0.55,0,false));
    circ.push([mx+nx*o,mz+nz*o]); }
  for(const sd of [-1,1]){ const cone=add(new THREE.ConeGeometry(0.35,0.9,10),M(0xff7a1a),g,(gapSide*-half*0.2)+sd*3,0.45,-2.4,false); }
  const pc=SKB.police(); pc.position.set(-gapSide*(half*0.45),0,3.2); pc.rotation.y=Math.PI/2*0.85; g.add(pc);
  const ox=-gapSide*(half*0.45); circ.push([mx+nx*ox+ux*3.2,mz+nz*ox+uz*3.2],[mx+nx*(ox+2)+ux*3.2,mz+nz*(ox+2)+uz*3.2],[mx+nx*(ox-2)+ux*3.2,mz+nz*(ox-2)+uz*3.2]);
  CH.blocks.push({g,circ,x:mx,z:mz,pc}); }
function chSiren(on){ try{ if(on&&!CH.sir){ ensureAudio(); if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type='square'; o.frequency.value=900; g.gain.value=0; const f=actx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1800; o.connect(f); f.connect(g); g.connect(master); o.start(); CH.sir={o,g}; }
  if(!on&&CH.sir){ CH.sir.o.stop(); CH.sir=null; } }catch(e){} }
function startChase(){ ensureAudio(); chModeExit(); sirenSet(false); stopFireworks&&stopFireworks();
  S.gm='chase'; CH.cops.forEach(p=>chDrop(p.m)); CH.blocks.forEach(b=>chDrop(b.g)); CH.cops=[]; CH.blocks=[]; CH.tLeft=60; CH.t=0; CH.hitT=-9; CH.nextBlock=6;
  S.level={id:'CHASE',limit:9,tod:'day'}; S.kase={id:'chase',title:'追逐模式',tips:[],steps:[],loc:null};
  resetActors(); setTOD(Math.random()<0.5?'day':'dusk'); clearEvents();
  const sp=taxiSpots(); const s0=sp[Math.random()*sp.length|0]; Object.assign(S.car,{x:s0.road[0],z:s0.road[1],a:s0.face+Math.PI/2,v:0}); S.camYaw=S.car.a;
  Object.assign(S,{mode:'drive',step:'chase',leftDepot:true,lives:5,collided:false,redRun:false,inX:-1,quizOpen:false,lastHit:-9,t0:performance.now()/1000,route:null,target:[S.car.x,S.car.z]});
  ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false;
  S.spawnFree=true; for(let n=0;n<20;n++){ const c={m:carModel(['taxi','car','bus','car','minibus','taxi','car'][n%7])}; if(placeCar(c,S.car.x,S.car.z)) cars.push(c); else dropModel(c.m); }
  for(let n=0;n<PED_N;n++){ const p={m:pedModel()}; if(placePed(p,S.car.x,S.car.z)) peds.push(p); else scene.remove(p.m); } S.spawnFree=false;
  chAddCop(); chAddCop();
  S.aeb=false; aebShow(); $('lives').style.display=''; drawLives(); show('menu',false); show('result',false); show('over',false); show('hudWrap',true); show('stabBox',false);
  $('txBig').style.display='block'; $('txBig').textContent='60'; document.body.classList.add('taxi');
  hud('🚓 追逐模式','警車 2 架 · 撐 60 秒'); caption('🚓 警車嚟緊！撐夠 60 秒就贏，撞到警車或者路障扣一粒心'); setTimeout(()=>{ if(S.gm==='chase'&&S.mode==='drive') caption(null); },3500);
  chSiren(true); }
function chHit(msg){ const now=performance.now()/1000; if(now-CH.hitT<1.5||S.mode!=='drive') return false; CH.hitT=now; S.lives--; drawLives(S.lives); toast(msg+'  −1 生命之星'); S.shake=0.6; vib(120);
  const lv=$('lives'); lv.classList.remove('hit'); void lv.offsetWidth; lv.classList.add('hit'); if(S.lives<=0) chaseEnd(false); return true; }
function chaseTick(dt){ const c=S.car, now=performance.now()/1000; CH.t+=dt; CH.tLeft-=dt; pedFlyTick(dt);
  const bc=$('txBig'), sec=Math.max(0,Math.ceil(CH.tLeft)); if(bc.textContent!==String(sec)){ bc.textContent=sec; bc.classList.toggle('warn',CH.tLeft<10); if(CH.tLeft<10){ bc.classList.remove('tick'); void bc.offsetWidth; bc.classList.add('tick'); } }
  $('hTime').textContent=fmt(Math.max(0,CH.tLeft));
  if(CH.tLeft<=0){ chaseEnd(true); return; }
  // 難度遞增：每 12 秒多一架警車（最多 6 架），定時加路障
  const want=Math.min(6,2+Math.floor(CH.t/12)); if(CH.cops.length<want&&Math.random()<dt*2){ chAddCop(); toast('🚨 多一架警車加入追捕！'); }
  if(CH.t>=CH.nextBlock){ CH.nextBlock+=Math.max(6,10-CH.t/15); chAddBlock(); }
  CH.blocks=CH.blocks.filter(b=>{ const far=Math.hypot(b.x-c.x,b.z-c.z)>280&&!inView(b.x,b.z,12); if(far) chDrop(b.g); return !far; });
  const AC=ambCircles(c.x,c.z,c.a), vmaxP=Math.min(34,25+CH.t*0.14); let nearest=1e9;
  for(const p of CH.cops){ const dx=c.x-p.x, dz=c.z-p.z, dist=Math.hypot(dx,dz); nearest=Math.min(nearest,dist);
    // 揾路：每秒用路網計一次去你嗰度嘅路；近距離就直接撲埋嚟
    p.pT-=dt; if(p.pT<=0){ p.pT=0.9+Math.random()*0.4; const r=route(nearestNode(p.x,p.z),nearestNode(c.x,c.z),[]); p.path=r?r.path.map(k=>NODES[k]):null; }
    let tx=c.x+Math.sin(c.a)*c.v*0.6, tz=c.z+Math.cos(c.a)*c.v*0.6;
    if(dist>38&&p.path&&p.path.length){ while(p.path.length>1&&Math.hypot(p.path[0][0]-p.x,p.path[0][1]-p.z)<10) p.path.shift(); tx=p.path[0][0]; tz=p.path[0][1]; }
    const want=Math.atan2(tx-p.x,tz-p.z); let da=((want-p.a)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI;
    if(p.back>0){ p.back-=dt; p.v=Math.max(-8,p.v-30*dt); p.a-=Math.sign(da||1)*1.6*dt; }
    else { const tgtV=vmaxP*(Math.abs(da)>1.2?0.45:Math.abs(da)>0.6?0.75:1); p.v+=(tgtV>p.v?18:-30)*dt; p.a+=Math.max(-2.6,Math.min(2.6,da*3))*dt*Math.min(1,Math.abs(p.v)/6+0.3); }
    const nx=p.x+Math.sin(p.a)*p.v*dt, nz=p.z+Math.cos(p.a)*p.v*dt;
    if(hitBuilding(nx,nz,p.a)){ p.v=-p.v*0.2; p.stuck+=dt; if(p.stuck>0.5){ p.back=0.9; p.stuck=0; } } else { p.x=nx; p.z=nz; p.stuck=Math.max(0,p.stuck-dt); }
    // 甩得太遠（又唔喺鏡頭入面）就喺你後面重新出現
    if(dist>320&&!inView(p.x,p.z,8)){ const s=chSpot(110,170,-1); if(s){ p.x=s.road[0]; p.z=s.road[1]; p.a=Math.atan2(c.x-p.x,c.z-p.z); p.v=10; p.path=null; } }
    // 撞到玩家
    if(dist<7){ for(const q of AC){ if(Math.hypot(q[0]-p.x,q[1]-p.z)<3.4){ if(chHit('俾警車撞到')){ p.back=1.0; p.v=-6; c.v=-c.v*0.3+Math.sign(p.v||1)*0; const L=dist||1; c.x+=dx/L*1.2; c.z+=dz/L*1.2; } break; } } }
    groundPose(p.m,p.x,0.12,p.z,p.a,6); const on=Math.floor(now*6)%2; p.m.userData.blues.forEach((b,i)=>b.material.emissive.setHex(((i%2)===on)?(b.userData.on||0x1550ff):0)); }
  // 撞到路障
  for(const b of CH.blocks){ if(Math.hypot(b.x-c.x,b.z-c.z)>20) continue; let hit=false; for(const q of AC){ for(const k of b.circ){ if(Math.hypot(q[0]-k[0],q[1]-k[1])<2.4){ hit=true; break; } } if(hit) break; }
    if(hit){ if(chHit('撞到路障')){ c.v=-c.v*0.35; } else c.v=Math.min(c.v,0); } const on=Math.floor(now*6)%2; b.pc.userData.blues.forEach((l,i)=>l.material.emissive.setHex(((i%2)===on)?(l.userData.on||0x1550ff):0)); }
  if(CH.sir){ const k=Math.max(0,1-nearest/130); CH.sir.g.gain.setTargetAtTime(0.035*k*k,actx.currentTime,0.05); CH.sir.o.frequency.setTargetAtTime(Math.floor(now*3)%2?1150:820,actx.currentTime,0.01); }
  $('hDist').textContent=nearest<1e8?Math.round(nearest)+' 米':'--'; hud('🚓 追逐模式',' · 警車 '+CH.cops.length+' 架 · 路障 '+CH.blocks.length+' 個');
}
function chaseEnd(win){ chSiren(false); S.mode='result'; caption(null); $('txBig').style.display='none'; document.body.classList.remove('taxi');
  const surv=Math.min(60,Math.round(CH.t)); S.stars=win?S.lives:0; S.tHosp=60-surv;
  const best=store.get('chaseBest',{st:0,s:0}), nb=(S.stars>best.st)||(S.stars===best.st&&surv>best.s); if(nb) store.set('chaseBest',{st:S.stars,s:surv});
  $('rTitle').textContent=win?'🏁 成功逃脫！':'🚓 被捕！'; $('rStars').innerHTML=win?[0,1,2,3,4].map(i=>'<span class="'+(i<S.lives?'on':'off')+'">'+lifeStar(34)+'</span>').join(''):'🚓';
  $('rTime').textContent=win?'撐足 60 秒，剩低 '+S.lives+' 粒生命之星':'撐咗 '+surv+' 秒'; $('rNote').innerHTML=nb?'🎉 新紀錄！':'最佳：'+(best.st?best.st+' 粒生命之星逃脫':'撐 '+best.s+' 秒');
  $('rAch').innerHTML=''; $('rTips').innerHTML='<small>警車會跟路網追你；路障留咗一條窄位可以鑽過去。開警號，路上啲車會讓路俾你。</small>'; $('rNext').style.display='none';
  $('rName').value=getName(); $('rSave').disabled=false; $('rSave').textContent='儲存到排行榜';
  show('result',true); show('hudWrap',false); if(win) fireworks(S.lives); }
function chaseExit(){ chSiren(false); CH.cops.forEach(p=>chDrop(p.m)); CH.blocks.forEach(b=>chDrop(b.g)); CH.cops=[]; CH.blocks=[]; $('txBig').style.display='none'; document.body.classList.remove('taxi');
  S.aeb=store.get('aeb',true); aebShow(); if(S.gm==='chase') S.gm='ems'; }
window.__CH=CH; window.__chBlock=chAddBlock;

/* ================= 模式 ③：自由探索（GTA 風格，冇計分） =================
   控制一個人周圍行，行近任何一部車撳「上車」：路上嘅車司機會自己落車行開；落車後架車會泊喺原位，可以再上。
   電腦：WASD／方向鍵行路，空白鍵跳，E 上落車，滑鼠拉動轉鏡頭。手機：左下角搖桿、右下角「跳」「上車」掣。 */
const FRE={ onFoot:true, p:null, vy:0, y:0, parked:[], leavers:[], joy:{x:0,y:0,on:false}, prevLiv:null, cand:null, kind:null };
// 路面車都可以揸：私家車、小巴（其他車款用返「車款」設定）
const FREE_SPEC={ car:{id:'fcar',kind:'car',name:'私家車',vmax:33,acc:1.15,steer:2.5,siren:false,lc:[0,0],tone:[0,0,500],circ:[-1.4,1.4],kl:0.75,kw:0.85,nose:2.3},
                  minibus:{id:'fminibus',kind:'minibus',name:'小巴',vmax:30,acc:1.0,steer:2.2,siren:false,lc:[0,0],tone:[0,0,500],circ:[-2.2,0,2.2],kl:1,kw:0.95,nose:3.4} };
const KIND2LIV={amb:'yellow',moto:'moto',police:'police',fire:'fire',taxi:'taxi',bus:'bus'};
function frModel(kind){ // 泊喺路邊嘅車（可以上）
  if(kind==='car'||kind==='minibus'||kind==='taxi'||kind==='bus'){ const g=carModel(kind); return g; }
  if(kind==='amb'){ const g=ambulance('A'+(100+Math.random()*90|0)); scene.add(g); const U=g.userData; if(U.pB){ U.pB.intensity=U.pR.intensity=0; U.pB.visible=U.pR.visible=false; } g.userData.len=6; return g; }
  const g=SKB[kind](); scene.add(g); g.userData.len=kind==='moto'?2.4:kind==='fire'?6.5:5.5; return g; }
function frPlayer(){ const g=pedModel(); g.scale.setScalar(1); const cap=new THREE.Mesh(new THREE.SphereGeometry(0.66,16,8,0,Math.PI*2,0,Math.PI/2),M(0x1f4fbf)); cap.position.set(0,2.2,-0.02); cap.scale.set(1,0.75,1); g.add(cap);
  const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.05,14,1,false,-Math.PI/2,Math.PI),M(0x183f99)); brim.position.set(0,2.24,0.4); brim.scale.set(1.1,1,0.8); g.add(brim); g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); return g; }
function frSpecFor(kind){ if(FREE_SPEC[kind]) return FREE_SPEC[kind]; return null; }
function frUseVehicle(kind){ // 換做呢款車嘅外型同性能
  const sp=FREE_SPEC[kind]; if(sp){ if(!SKB[kind]) SKB[kind]=()=>{ const g=carModel(kind); scene.remove(g); g.userData.blues=[]; return g; }; const L=LIVERY.find(l=>l.id===sp.id); if(!L) LIVERY.push(Object.assign({need:999,hidden:true,d:'',sw:'#ccc',col:0},sp)); applyLivery(sp.id); }
  else applyLivery(KIND2LIV[kind]||'yellow');
  store.set('livery',FRE.prevLiv); FRE.kind=kind; }
function startFree(){ ensureAudio(); chModeExit(); sirenSet(false); stopFireworks&&stopFireworks();
  if(S.gm!=='free') FRE.prevLiv=store.get('livery','yellow'); S.gm='free';
  S.level={id:'FREE',limit:9,tod:'day'}; S.kase={id:'free',title:'自由探索',tips:[],steps:[],loc:null};
  resetActors(); setTOD('day'); clearEvents(); frClear();
  // 喺屯門市廣場附近條街落地，路邊泊住幾部特別車俾你試
  const sp=taxiSpots().filter(s=>s.p[0]<200&&s.p[0]>-200&&s.p[1]>-200&&s.p[1]<300); const s0=sp[Math.random()*sp.length|0];
  Object.assign(S.car,{x:s0.p[0],z:s0.p[1],a:s0.face,v:0}); S.camYaw=S.car.a;
  Object.assign(S,{mode:'drive',step:'free',leftDepot:true,lives:5,collided:false,inX:-1,quizOpen:false,lastHit:-9,route:null,target:[S.car.x,S.car.z]});
  ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false;
  const ux=Math.sin(s0.face+Math.PI/2), uz=Math.cos(s0.face+Math.PI/2);
  ['amb','police','fire','moto'].forEach((k,i)=>{ const x=s0.road[0]+ux*(i*9-13.5), z=s0.road[1]+uz*(i*9-13.5); frPark(k,x,z,s0.face+Math.PI/2); });
  S.spawnFree=true; for(let n=0;n<20;n++){ const kd=['taxi','car','bus','car','minibus','taxi','car'][n%7]; const c={m:carModel(kd),kind:kd}; if(placeCar(c,S.car.x,S.car.z)) cars.push(c); else dropModel(c.m); }
  for(let n=0;n<PED_N;n++){ const p={m:pedModel()}; if(placePed(p,S.car.x,S.car.z)) peds.push(p); else scene.remove(p.m); } S.spawnFree=false;
  FRE.p=frPlayer(); FRE.onFoot=true; FRE.y=0; FRE.vy=0; amb.visible=false; FRE.prevAeb=S.aeb; S.aeb=false; aebShow();
  $('lives').style.display='none'; show('menu',false); show('result',false); show('over',false); show('hudWrap',true); show('stabBox',false);
  frUI(); hud('🚶 自由探索',' · 行近車撳「上車」'); $('hDist').textContent='--'; $('hTime').textContent='--';
  caption('🚶 自由探索：周圍行吓！行近任何一部車撳「上車」'); setTimeout(()=>{ if(S.gm==='free') caption(null); },3500); }
function frPark(kind,x,z,a){ const m=frModel(kind); groundPose(m,x,0.1,z,a,m.userData.len||5); FRE.parked.push({m,kind,x,z,a}); }
function frClear(){ FRE.parked.forEach(q=>dropModel(q.m)); FRE.parked=[]; FRE.leavers.forEach(l=>scene.remove(l.m)); FRE.leavers=[]; if(FRE.p){ scene.remove(FRE.p); FRE.p=null; } }
function frUI(){ const foot=S.gm==='free'&&FRE.onFoot; document.body.classList.toggle('free-foot',foot); document.body.classList.toggle('free-car',S.gm==='free'&&!FRE.onFoot);
  $('bExit').style.display=S.gm==='free'&&!FRE.onFoot?'flex':'none'; }
function frNearest(){ const c=S.car; let best=null,bd=6.5;
  for(const k of cars){ if(!k.pose) continue; const d=Math.hypot(k.pose.x-c.x,k.pose.z-c.z)-(k.m.userData.len||4)/2*0.6; if(d<bd){ bd=d; best={t:'car',k}; } }
  for(const q of FRE.parked){ const d=Math.hypot(q.x-c.x,q.z-c.z)-(q.m.userData.len||4)/2*0.6; if(d<bd){ bd=d; best={t:'park',q}; } }
  return best; }
function frEnter(){ const n=FRE.cand; if(!n||!FRE.onFoot) return; const c=S.car; let kind,x,z,a;
  if(n.t==='car'){ const k=n.k; kind=k.kind||(k.m.userData.len>20?'bus':k.m.userData.len===7?'minibus':'car'); x=k.pose.x; z=k.pose.z; a=k.pose.a;
    const i=cars.indexOf(k); if(i>=0) cars.splice(i,1); dropModel(k.m);
    // 司機自己落車，行開幾步就走
    const dm=pedModel(); const sx=x+Math.sin(a+Math.PI/2)*2.6, sz=z+Math.cos(a+Math.PI/2)*2.6; dm.position.set(sx,ELEV(sx,sz),sz); FRE.leavers.push({m:dm,x:sx,z:sz,a:a+Math.PI/2+(Math.random()-0.5),t:0});
    toast('司機落咗車行開'); }
  else { const q=n.q; kind=q.kind; x=q.x; z=q.z; a=q.a; dropModel(q.m); FRE.parked.splice(FRE.parked.indexOf(q),1); }
  frUseVehicle(kind); amb.visible=true; scene.remove(FRE.p); FRE.onFoot=false; Object.assign(S.car,{x,z,a,v:0}); S.camYaw=a; FRE.cand=null; frUI();
  hud('🚗 '+(FREE_SPEC[kind]?FREE_SPEC[kind].name:VSPEC.name),' · 停車撳「落車」'); }
function frExit(){ if(FRE.onFoot) return; const c=S.car; if(Math.abs(c.v)>3){ toast('停定先落車'); return; } sirenSet(false);
  frPark(FRE.kind,c.x,c.z,c.a); amb.visible=false;
  let px=c.x+Math.sin(c.a+Math.PI/2)*3.2, pz=c.z+Math.cos(c.a+Math.PI/2)*3.2; if(cellAt(px,pz)&6){ px=c.x-Math.sin(c.a+Math.PI/2)*3.2; pz=c.z-Math.cos(c.a+Math.PI/2)*3.2; }
  FRE.p=frPlayer(); FRE.onFoot=true; FRE.y=0; FRE.vy=0; Object.assign(S.car,{x:px,z:pz,v:0}); frUI(); hud('🚶 自由探索',' · 行近車撳「上車」'); }
function frJump(){ if(FRE.onFoot&&FRE.y<=0.01){ FRE.vy=7; } }
// 每格：行路物理、上車提示、司機行開
function freeTick(dt,t){ const c=S.car; pedFlyTick(dt);
  FRE.leavers=FRE.leavers.filter(l=>{ l.t+=dt; l.x+=Math.sin(l.a)*2.4*dt; l.z+=Math.cos(l.a)*2.4*dt; l.m.position.set(l.x,ELEV(l.x,l.z),l.z); l.m.rotation.y=l.a; walk(l.m,t,true);
    if(l.t>5&&!inView(l.x,l.z,4)||l.t>12){ scene.remove(l.m); return false; } return true; });
  if(FRE.onFoot){ const H=S.hold, J=FRE.joy; let fwd=(H.G?1:0)-(H.B?1:0), side=(H.L?1:0)-(H.R?1:0); if(J.on){ fwd=-J.y; side=-J.x; }
    const mag=Math.min(1,Math.hypot(fwd,side)); const yaw=S.camYaw+S.camDrag.yaw;
    if(mag>0.08){ const mx=Math.sin(yaw)*fwd+Math.sin(yaw+Math.PI/2)*side, mz=Math.cos(yaw)*fwd+Math.cos(yaw+Math.PI/2)*side; const want=Math.atan2(mx,mz);
      c.a+=((want-c.a+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*10); const sp=7*mag, L=Math.hypot(mx,mz)||1; const nx=c.x+mx/L*sp*dt, nz=c.z+mz/L*sp*dt;
      if(!(cellAt(nx,c.z)&6)) c.x=nx; if(!(cellAt(c.x,nz)&6)) c.z=nz; }
    FRE.vy-=22*dt; FRE.y=Math.max(0,FRE.y+FRE.vy*dt); if(FRE.y===0) FRE.vy=0;
    FRE.p.position.set(c.x,ELEV(c.x,c.z)+FRE.y,c.z); FRE.p.rotation.y=c.a; walk(FRE.p,t,mag>0.08&&FRE.y===0);
    c.v=0; FRE.cand=frNearest(); $('bEnter').disabled=!FRE.cand; $('bEnter').classList.toggle('ready',!!FRE.cand);
    hud('🚶 自由探索',FRE.cand?' · 撳「上車」揸呢部車':' · 行近車撳「上車」'); }
  $('hDist').textContent=Math.round(Math.abs(c.v)*3.6)+' 公里/小時'; }
function freeExit(){ frClear(); amb.visible=true; FRE.onFoot=true; if(S.gm==='free'){ S.gm='ems'; applyLivery(FRE.prevLiv||'yellow'); store.set('livery',FRE.prevLiv||'yellow'); S.aeb=store.get('aeb',true); aebShow(); }
  document.body.classList.remove('free-foot','free-car'); $('bExit').style.display='none'; }
// 手機搖桿
{ const J=$('joy'), K=$('joyK'); let id=null, cx=0, cy=0; const R=46;
  J.addEventListener('pointerdown',e=>{ id=e.pointerId; const r=J.getBoundingClientRect(); cx=r.left+r.width/2; cy=r.top+r.height/2; FRE.joy.on=true; try{ J.setPointerCapture(id); }catch(_){} mv(e); e.preventDefault(); });
  const mv=e=>{ if(e.pointerId!==id) return; let dx=e.clientX-cx, dy=e.clientY-cy; const L=Math.hypot(dx,dy); if(L>R){ dx*=R/L; dy*=R/L; } K.style.transform='translate('+dx+'px,'+dy+'px)'; FRE.joy.x=dx/R; FRE.joy.y=dy/R; };
  J.addEventListener('pointermove',mv);
  ['pointerup','pointercancel'].forEach(ev=>J.addEventListener(ev,e=>{ if(e.pointerId!==id) return; id=null; FRE.joy.on=false; FRE.joy.x=FRE.joy.y=0; K.style.transform=''; })); }
$('bEnter').onclick=()=>frEnter(); $('bJump').onclick=()=>frJump(); $('bExit').onclick=()=>frExit();
addEventListener('keydown',e=>{ if(S.gm!=='free'||S.mode!=='drive') return; const tg=e.target; if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA')) return;
  if(e.code==='KeyE'&&!e.repeat){ FRE.onFoot?frEnter():frExit(); } if(e.code==='Space'){ frJump(); e.preventDefault(); } });
window.__FR=FRE;

/* ================= CPR（測試）模式：人事不省、CPR + AED =================
   跟消防處「心肺復甦法及自動心臟除顫器簡介」嘅 4C 程序：冷靜 → 檢查 → 召喚 → CPR + AED
   教學模式：每步有解說同提示；練習模式：冇提示，做錯先提醒（唔計分）。                        */
const CP={on:false,mode:'teach',breaths:false,step:'',sub:0,t:0,warn:[],m:{},hot:[],comp:0,taps:[],set:0,pads:0,clear:false,dial:'',called:false,aedAsked:false,
  shoulders:0,shout:false,air:[false,false],brT:0,blow:0,rateWarned:false,metro:null,camMode:'walk',scanA:0,V:null,u:null,tv:null,jolt:0,amb:0};
const CPV={}; ['on','pads','analyse','shock','done','notouch'].forEach(k=>{ try{ const a=new Audio('cpr/'+k+'.mp3'); a.preload='auto'; CPV[k]=a; }catch(e){} });
function cpSay(k){ try{ Object.values(CPV).forEach(a=>{ a.pause(); a.currentTime=0; }); const a=CPV[k]; if(a){ a.currentTime=0; a.play().catch(()=>{}); } }catch(e){} }
function cpBeep(f,d,v){ if(!actx) return; try{ const o=actx.createOscillator(), g=actx.createGain(); o.frequency.value=f; o.type='sine'; g.gain.value=v||0.08; o.connect(g); g.connect(master); o.start(); g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+d); o.stop(actx.currentTime+d+0.02); }catch(e){} }
function cpMetro(on){ if(CP.metro){ clearInterval(CP.metro); CP.metro=null; } if(on) CP.metro=setInterval(()=>cpBeep(1050,0.05,0.07),545); }   // 每分鐘 110 下
const $cp=id=>document.getElementById(id);
function cpEl(tag,cls,txt){ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }

/* ---------- 場景 ---------- */
/* ---------- 3D 模型：CPR 訓練公仔（似 Resusci Anne）、AED 機、電極片 ---------- */
const MK=1.35, MKY=0.2;   // 公仔放大比例；瞓低時背脊離地高度
function cpCanvas(w,h,fn){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); fn(g,w,h); const t=new THREE.CanvasTexture(c); t.anisotropy=4; return t; }
function cprr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function chestTex(){ return cpCanvas(256,390,(g,w,h)=>{ const X=x=>(x+0.25)/0.5*w, Y=y=>(2.16-y)/0.76*h;
  const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,'#d9b393'); gr.addColorStop(0.18,'#ecccb0'); gr.addColorStop(0.82,'#ecccb0'); gr.addColorStop(1,'#d9b393'); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.lineCap='round'; g.lineJoin='round';
  // 鎖骨同胸骨上窩
  g.strokeStyle='rgba(150,100,70,.55)'; g.lineWidth=5; [-1,1].forEach(s=>{ g.beginPath(); g.moveTo(X(s*0.03),Y(2.085)); g.quadraticCurveTo(X(s*0.12),Y(2.05),X(s*0.24),Y(2.1)); g.stroke(); });
  g.fillStyle='rgba(150,100,70,.35)'; g.beginPath(); g.ellipse(X(0),Y(2.095),9,6,0,0,7); g.fill();
  // 胸骨（中線）同劍突
  g.strokeStyle='rgba(160,110,80,.35)'; g.lineWidth=9; g.beginPath(); g.moveTo(X(0),Y(2.07)); g.lineTo(X(0),Y(1.66)); g.stroke();
  g.fillStyle='rgba(150,100,70,.35)'; g.beginPath(); g.moveTo(X(-0.018),Y(1.665)); g.lineTo(X(0.018),Y(1.665)); g.lineTo(X(0),Y(1.62)); g.fill();
  // 胸肌下緣
  g.strokeStyle='rgba(140,90,60,.55)'; g.lineWidth=5; [-1,1].forEach(s=>{ g.beginPath(); g.moveTo(X(s*0.03),Y(1.79)); g.bezierCurveTo(X(s*0.1),Y(1.75),X(s*0.19),Y(1.77),X(s*0.235),Y(1.9)); g.stroke(); });
  // 乳頭同乳暈
  [-1,1].forEach(s=>{ g.fillStyle='#c98f74'; g.beginPath(); g.arc(X(s*0.11),Y(1.87),8,0,7); g.fill(); g.fillStyle='#a8674f'; g.beginPath(); g.arc(X(s*0.11),Y(1.87),3.5,0,7); g.fill(); });
  // 肋骨下緣（倒 V）同幾條肋骨陰影
  g.strokeStyle='rgba(140,90,60,.5)'; g.lineWidth=5; g.beginPath(); g.moveTo(X(-0.24),Y(1.5)); g.quadraticCurveTo(X(-0.1),Y(1.56),X(0),Y(1.63)); g.quadraticCurveTo(X(0.1),Y(1.56),X(0.24),Y(1.5)); g.stroke();
  g.strokeStyle='rgba(140,90,60,.22)'; g.lineWidth=3; [1.98,1.7,1.62].forEach(y=>[-1,1].forEach(s=>{ g.beginPath(); g.moveTo(X(s*0.05),Y(y)); g.quadraticCurveTo(X(s*0.16),Y(y-0.03),X(s*0.245),Y(y+0.02)); g.stroke(); }));
  // 腹部中線同肚臍
  g.strokeStyle='rgba(150,100,70,.18)'; g.lineWidth=3; g.beginPath(); g.moveTo(X(0),Y(1.6)); g.lineTo(X(0),Y(1.43)); g.stroke();
  g.fillStyle='#b98366'; g.beginPath(); g.ellipse(X(0),Y(1.42),4,6,0,0,7); g.fill(); }); }
function limb(p,a,b,r1,r2,mat){ const A=new THREE.Vector3(...a), B=new THREE.Vector3(...b), d=B.clone().sub(A), L=d.length();
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,L,10),mat); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); p.add(m); return m; }
function handsModel(){ // 救人者雙手（第一身）：下面隻手掌根壓胸骨，上面隻手交疊、手指緊扣；手臂伸直，由救人者膊頭落嚟（+z 橫跨胸口，-z 係救人者嗰邊）
  const g=new THREE.Group(), sk=M(0xf1c9a5,{r:0.6}), sl=M(0x2f80ed,{r:0.7}), K=1.35;
  const palm=(y,ry)=>{ const h=new THREE.Group(); h.position.y=y; h.rotation.y=ry; g.add(h); add(rbox(0.17*K,0.055*K,0.2*K,0.03),sk,h,0,0,0);
    for(let i=0;i<4;i++){ const f=add(cyl(0.019*K,0.017*K,0.11*K,8),sk,h,(-0.06+i*0.04)*K,0,0.15*K,false); f.rotation.x=Math.PI/2; }
    const th=add(cyl(0.022*K,0.019*K,0.09*K,8),sk,h,0.1*K,0,0.02*K,false); th.rotation.z=Math.PI/2.5; return h; };
  palm(0.03,0); const top=palm(0.1,0.25); top.children.slice(1,5).forEach(f=>{ f.rotation.x=Math.PI/2+1.1; f.position.y-=0.05; f.position.z-=0.03; });
  [-1,1].forEach(sd=>{ const w=[sd*0.07*K,0.08,-0.08*K], el=[sd*0.13*K,0.55,-0.32*K], sh=[sd*0.22*K,1.15,-0.6*K];
    limb(g,w,el,0.05*K,0.045*K,sk); limb(g,[el[0],el[1]-0.06,el[2]+0.03],sh,0.075*K,0.085*K,sl); });   // 前臂（皮）、上臂（衫袖），手肘伸直
  g.visible=false; return g; }
function manikinModel(){ // 企喺度嘅座標：y 向上、面向 +z；全身約 2.6 × MK
  const g=new THREE.Group(), skin=M(0xeccbb0,{r:0.55}), skinD=M(0xd9b090,{r:0.6}), suit=M(0x2a5db0,{r:0.7}), hair=M(0x8a5a3c,{r:0.5}), dark=M(0x3a2a2a);
  // 腳（藍色運動褲）同鞋
  [-0.13,0.13].forEach(x=>{ add(cyl(0.115,0.1,1.08,12),suit,g,x,0.62,0); add(rbox(0.2,0.12,0.32,0.05),M(0x222831),g,x,0.06,0.06); });
  add(rbox(0.48,0.3,0.3,0.1),suit,g,0,1.28,0);                    // 盆骨
  // 胸腹：赤裸膠皮（可以貼電極片），胸前有乳頭同胸骨位
  const torso=add(rbox(0.52,0.78,0.3,0.12),skin,g,0,1.78,0); g.userData.torso=torso;
  // 胸口貼圖：鎖骨、胸骨、胸肌輪廓、乳頭、肋骨下緣、劍突、肚臍（貼喺身軀前面，按壓時跟住壓落）
  const chest=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.76),new THREE.MeshStandardMaterial({map:chestTex(),roughness:0.55})); chest.position.set(0,0,0.151); torso.add(chest);
  add(rbox(0.6,0.16,0.28,0.07),skin,g,0,2.12,0);                  // 膊頭
  add(cyl(0.075,0.085,0.16,10),skin,g,0,2.25,0);                  // 頸
  // 手：上臂、前臂同手掌
  const arms=[-1,1].map(s=>{ const a=new THREE.Group(); a.position.set(s*0.33,2.1,0); g.add(a); add(cyl(0.075,0.068,0.42,10),skin,a,0,-0.21,0); add(cyl(0.065,0.055,0.4,10),skin,a,0,-0.62,0); add(sph(0.07),skin,a,0,-0.86,0); return a; });
  // 頭：膠面、閉眼、鼻、張開嘅口（做人工呼吸）、膠頭髮
  const head=new THREE.Group(); head.position.set(0,2.47,0); g.add(head);
  const hd=add(sph(0.19),skin,head,0,0,0); hd.scale.set(0.9,1.12,1);
  const hr=add(new THREE.SphereGeometry(0.195,20,12,0,Math.PI*2,0,Math.PI*0.55),hair,head,0,0.02,-0.015,false); hr.scale.set(0.93,1.15,1.03);
  [-0.06,0.06].forEach(x=>{ const e=add(new THREE.BoxGeometry(0.055,0.008,0.01),dark,head,x,0.03,0.172,false); });
  add(new THREE.ConeGeometry(0.03,0.07,8),skinD,head,0,-0.01,0.19,false).rotation.x=Math.PI/2;
  const mo=add(new THREE.CircleGeometry(0.03,12),M(0x5a2a2a),head,0,-0.085,0.171,false); mo.scale.set(1.3,0.8,1);
  // 上衣（用 AED 前要除去）：淺灰白色 polo，有領同短袖
  const shirt=new THREE.Group(); g.add(shirt); const sm=M(0xe9edf2,{r:0.8}), sc=M(0x2a5db0,{r:0.7});
  add(rbox(0.57,0.82,0.35,0.13),sm,shirt,0,1.77,0); add(rbox(0.64,0.18,0.31,0.08),sm,shirt,0,2.12,0);
  add(rbox(0.2,0.05,0.04,0.02),sc,shirt,0,2.2,0.15,false); add(rbox(0.04,0.2,0.02,0.01),sc,shirt,0,2.08,0.18,false);
  arms.forEach(a=>add(cyl(0.095,0.09,0.22,10),sm,a,0,-0.1,0));
  g.userData.arms=arms; g.userData.head=head; g.userData.shirt=shirt; g.scale.setScalar(MK); return g; }
// 公仔身上嘅位置（企喺度座標）。電極片：右邊鎖骨下、胸骨右側；左邊腋中線、約第 5–6 肋間（乳頭水平以下、貼喺側邊）
const CPPT={ shL:[0.27,2.1,0.12], shR:[-0.27,2.1,0.12], fore:[0,2.6,0.16], chin:[0,2.3,0.15],
  chUp:[0,2.06,0.16], chMid:[0,1.86,0.17], belly:[0,1.46,0.16],
  padA:[-0.125,1.96,0.16], padB:[0.262,1.7,0.04], padX:[0.125,1.96,0.16], padY:[0,1.42,0.16], padZ:[0.11,1.72,0.16] };
const PADPOSE={ padA:{p:[-0.125,1.955,0.153],ry:0,rz:-0.12}, padB:{p:[0.264,1.7,0.0],ry:Math.PI/2,rz:0} };   // 第一塊：上緣喺鎖骨下面、內緣喺胸骨右邊；第二塊：左腋中線、乳頭水平以下，直放   // 貼片喺公仔局部座標嘅位置同方向
// 電極片：白色片、藍色／紅色框、印住簡單貼位圖（參考用戶提供嘅 AED 圖片）
function padTex(n){ const col=n===1?'#2b6fd6':'#d8323c'; return cpCanvas(256,320,(g,w,h)=>{ g.fillStyle='#fbfbfc'; cprr(g,4,4,w-8,h-8,46); g.fill(); g.strokeStyle='#d5dae0'; g.lineWidth=4; g.stroke();
  g.strokeStyle=col; g.lineWidth=7; cprr(g,30,44,w-60,h-80,34); g.stroke();
  g.strokeStyle=col; g.lineWidth=4; g.beginPath(); g.arc(128,110,20,0,7); g.stroke(); cprr(g,84,136,88,110,22); g.stroke();
  g.fillStyle=col; g.globalAlpha=0.85; if(n===1) cprr(g,94,146,26,34,5); else cprr(g,148,180,16,40,5); g.fill(); g.globalAlpha=1;
  g.fillStyle=col; g.font='bold 34px sans-serif'; g.textAlign='center'; g.fillText(n,128,286);
  g.fillStyle='#e6e9ec'; g.beginPath(); g.arc(128,14,10,0,7); g.fill(); }); }
const PADT=[null,padTex(1),padTex(2)];
// 機面螢幕：教學插圖（貼片位置＋按壓），自己畫，冇品牌
function aedScreenTex(){ return cpCanvas(512,300,(g,w,h)=>{ g.fillStyle='#f6a43a'; g.fillRect(0,0,w,h); g.fillStyle='#ffe2b8'; g.fillRect(6,6,w/2-9,h-12); g.fillRect(w/2+3,6,w/2-9,h-12);
  g.fillStyle='#f2c9a6'; g.strokeStyle='#8a5a3a'; g.lineWidth=3; g.beginPath(); g.arc(128,70,30,0,7); g.fill(); g.stroke(); cprr(g,70,104,116,170,28); g.fill(); g.stroke();
  g.fillStyle='#fff'; g.strokeStyle='#e06a00'; g.lineWidth=3; cprr(g,82,118,32,38,5); g.fill(); g.stroke(); cprr(g,150,158,24,44,5); g.fill(); g.stroke();
  g.fillStyle='#2b6fd6'; g.beginPath(); g.arc(320,190,14,0,7); g.fill(); g.fillStyle='#fff'; g.fillRect(300,198,170,40); g.fillStyle='#f2c9a6'; g.beginPath(); g.arc(436,90,26,0,7); g.fill(); g.stroke();
  g.strokeStyle='#5b6a80'; g.lineWidth=14; g.beginPath(); g.moveTo(426,118); g.lineTo(370,190); g.stroke(); g.fillStyle='#fff'; g.beginPath(); g.arc(370,196,14,0,7); g.fill(); }); }
function aedLidTex(){ return cpCanvas(512,560,(g,w,h)=>{ g.fillStyle='#f39a1e'; g.fillRect(0,0,w,h);
  g.fillStyle='#e48a10'; cprr(g,40,30,w-80,90,30); g.fill(); g.fillStyle='#3a3a3a'; cprr(g,120,48,w-240,52,22); g.fill();   // 手挽位
  g.fillStyle='#fff'; g.beginPath(); g.moveTo(256,150); g.lineTo(236,176); g.lineTo(276,176); g.fill();   // 箭咀
  g.fillStyle='#dfe7f5'; cprr(g,170,200,172,40,8); g.fill(); g.fillStyle='#1d3f86'; g.font='bold 24px sans-serif'; g.textAlign='center'; g.fillText('⌛ 2026-11-18',256,229);
  g.strokeStyle='#fff'; g.lineWidth=12; g.lineJoin='round'; g.beginPath(); g.moveTo(256,470); g.bezierCurveTo(150,400,150,290,212,290); g.bezierCurveTo(240,290,256,310,256,326); g.bezierCurveTo(256,310,272,290,300,290); g.bezierCurveTo(362,290,362,400,256,470); g.stroke();
  g.fillStyle='#fff'; g.beginPath(); g.moveTo(262,320); g.lineTo(234,384); g.lineTo(258,384); g.lineTo(246,436); g.lineTo(284,368); g.lineTo(260,368); g.lineTo(276,320); g.fill();
  g.font='bold 64px sans-serif'; g.fillText('AED',256,540); }); }
function aedFaceTex(){ return cpCanvas(512,560,(g,w,h)=>{ g.fillStyle='#f39a1e'; g.fillRect(0,0,w,h); g.fillStyle='#6b7079'; cprr(g,22,22,w-44,h-150,26); g.fill();
  g.fillStyle='#dfe2e6'; g.font='bold 24px sans-serif'; g.textAlign='center'; g.fillText('AED',256,58);
  g.fillStyle='#3d4148'; for(let r=0;r<7;r++) for(let c=0;c<7;c++){ const x=62+c*12, y=300+r*12; if((x-98)**2+(y-336)**2<1500){ g.beginPath(); g.arc(x,y,3.6,0,7); g.fill(); } }   // 喇叭
  g.fillStyle='#2b2d31'; cprr(g,40,454,w-80,74,22); g.fill(); g.fillStyle='#4a4d52'; cprr(g,196,466,120,26,8); g.fill();   // 前面手挽位
  g.fillStyle='#4a4f57'; cprr(g,404,92,60,30,6); g.fill(); cprr(g,404,134,60,30,6); g.fill(); g.fillStyle='#fff'; g.font='bold 18px sans-serif'; g.fillText('i',434,113); g.fillText('成人/兒童',434,180); }); }
let AEDT=null;
function aedModel(small){ if(!AEDT){ AEDT={face:aedFaceTex(),lid:aedLidTex(),scr:aedScreenTex()}; }
  const g=new THREE.Group(), orange=M(0xf39a1e,{r:0.45}), grey=M(0x6b7079,{r:0.55}), dark=M(0x2b2d31,{r:0.7});
  add(rbox(0.92,0.24,1.0,0.12),orange,g,0,0.12,0);                                       // 橙色機身
  add(rbox(0.94,0.06,1.02,0.04),M(0x4a4d52,{r:0.7}),g,0,0.03,0,false);                     // 底部深灰膠邊
  const face=new THREE.Mesh(new THREE.PlaneGeometry(0.88,0.96),new THREE.MeshStandardMaterial({map:AEDT.face,roughness:0.5})); face.rotation.x=-Math.PI/2; face.position.set(0,0.242,0.01); g.add(face);
  const scr=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.3),new THREE.MeshBasicMaterial({map:AEDT.scr})); scr.rotation.x=-Math.PI/2; scr.position.set(0.04,0.246,-0.12); g.add(scr);
  // 橙色電擊掣（三角形、有閃電）
  const shk=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.085,0.04,3),new THREE.MeshBasicMaterial({color:0xb4560a})); shk.position.set(0,0.262,0.17); shk.rotation.y=Math.PI; g.add(shk);
  const bolt=new THREE.Mesh(new THREE.PlaneGeometry(0.08,0.08),new THREE.MeshBasicMaterial({map:cpCanvas(64,64,(c)=>{ c.fillStyle='#fff'; c.font='bold 48px sans-serif'; c.textAlign='center'; c.fillText('⚡',32,50); }),transparent:true}));
  bolt.rotation.x=-Math.PI/2; bolt.position.set(0,0.284,0.18); g.add(bolt);
  const ready=add(sph(0.016),new THREE.MeshBasicMaterial({color:0x1d3a24}),g,0.31,0.25,0.08,false);   // 就緒燈
  // 左上角電極插頭（藍色）
  const port=add(rbox(0.07,0.05,0.07,0.02),M(0x2b6fd6,{r:0.4}),g,-0.36,0.27,-0.42,false);
  // 機蓋：鉸喺後面，打開即自動開機；外面有心形閃電標誌同「AED」，裏面有窗位
  const lid=new THREE.Group(); lid.position.set(0,0.24,-0.5); g.add(lid);
  add(rbox(0.92,0.08,1.0,0.06),orange,lid,0,0.04,0.5,false);
  const lo=new THREE.Mesh(new THREE.PlaneGeometry(0.86,0.94),new THREE.MeshStandardMaterial({map:AEDT.lid,roughness:0.5})); lo.rotation.x=-Math.PI/2; lo.rotation.z=Math.PI; lo.position.set(0,0.082,0.5); lid.add(lo);
  const win=add(rbox(0.26,0.02,0.12,0.03),M(0xf6f6f2,{r:0.4}),lid,0,-0.005,0.62,false);
  // 電極片包（未用時放喺機面上）
  const pk=new THREE.Mesh(new THREE.PlaneGeometry(0.2,0.25),new THREE.MeshStandardMaterial({map:PADT[1]})); pk.rotation.x=-Math.PI/2; pk.position.set(-0.3,0.25,-0.3); pk.visible=false; g.add(pk);
  g.userData={led:ready,leds:[],shk,port,lid,pk}; if(small){ g.scale.setScalar(0.62); } return g; }
function aedOpen(A,f){ A.userData.lid.rotation.x=-1.95*f; }
function cpW(lx,ly,lz){ const v=new THREE.Vector3(lx,ly,lz); CP.m.vp.localToWorld(v); return v; }   // 公仔局部座標 → 世界座標
function cpBuild(){
  const L=LMK.plaza; const V=L.patient, st=L.stop; let ux=V[0]-st[0], uz=V[1]-st[1]; const n=Math.hypot(ux,uz)||1; ux/=n; uz/=n;
  CP.V=V; CP.u=[ux,uz]; CP.tv=[uz,-ux];   // u：由馬路指向行人路；tv：沿住行人路（病人頭嘅方向）
  const vic=new THREE.Group(); scene.add(vic); vic.position.set(V[0],0.12,V[1]); vic.rotation.y=Math.atan2(-CP.tv[0],-CP.tv[1]);
  const p=manikinModel(); vic.add(p); p.position.set(0,0,0); p.userData.stand=true;   // 開頭企喺度，暈低先瞓低
  CP.m.vic=vic; CP.m.vp=p;
  const me=person('bystander'); me.children[0].material.color.set(0x2f80ed); scene.add(me); CP.m.me=me;
  const hp=person('bystander'); hp.children[0].material.color.set(0x34b37a); scene.add(hp); CP.m.hp=hp; hp.visible=false;
  const aed=aedModel(false); scene.add(aed); aed.visible=false; CP.m.aed=aed; CP.m.pads=[];
  CP.m.hands=handsModel(); scene.add(CP.m.hands);
  CP.m.carry=aedModel(true); hp.add(CP.m.carry); CP.m.carry.position.set(0.85,0.75,0.2); CP.m.carry.rotation.z=Math.PI/2;
}
function cpDrop(){ ['vic','me','hp','aed','hands'].forEach(k=>{ const g=CP.m[k]; if(g) scene.remove(g); }); (CP.m.pads||[]).forEach(p=>p.parent&&p.parent.remove(p)); CP.m={}; }
function cpLay(){ const p=CP.m.vp; p.rotation.x=-Math.PI/2; p.position.set(0,MKY*MK,0); p.userData.stand=false; p.userData.arms.forEach((a,i)=>{ a.rotation.x=0; a.rotation.z=(i?1:-1)*0.6; }); }
function cpPlace(g,wx,wz,face,kneel){ g.position.set(wx,kneel?-0.55:0.12,wz); g.rotation.y=face; g.userData.legL.rotation.x=kneel?1.5:0; g.userData.legR.rotation.x=kneel?1.5:0; }
function cpKneelSpots(){ const C=cpW(...CPPT.chMid); const u=CP.u;
  return {me:[C.x-u[0]*1.45,C.z-u[1]*1.45], hp:[C.x+u[0]*1.7+CP.tv[0]*1.5,C.z+u[1]*1.7+CP.tv[1]*1.5], C}; }

/* ---------- 介面 ---------- */
function cpUI(){ let w=$cp('cp'); if(w) return w;
  w=cpEl('div',null); w.id='cp'; w.innerHTML='<div class="cpchip" id="cpChip"></div><div class="cptxt" id="cpTxt"></div><div class="cpgauge" id="cpGauge"><b id="cpRate">--</b><span>下／分鐘</span><i><em id="cpBar"></em></i><span id="cpCnt"></span></div><div class="cpact" id="cpAct"></div>';
  document.body.append(w); const h=cpEl('div',null); h.id='cpHot'; document.body.append(h); const r=cpEl('div',null); r.id='cpWarn'; document.body.append(r); return w; }
function cpSet(chip,teach,practice,acts){ cpUI(); $cp('cpChip').textContent=chip; const tx=$cp('cpTxt'); tx.textContent=CP.mode==='teach'?teach:(practice||teach); if(CP.note){ const n=cpEl('b','cpnote',CP.note); tx.prepend(n); CP.note=''; }
  const A=$cp('cpAct'); A.innerHTML=''; (acts||[]).forEach(a=>{ const b=cpEl('button','cpb'+(a.cls?' '+a.cls:''),a.t); if(a.ok) b.classList.add('hint'); b.onclick=()=>a.fn(b); A.append(b); }); $cp('cpGauge').style.display='none'; }
function cpHot(list){ // list: [{k:'shL',t:'膊頭',ok:true,fn}]
  const H=$cp('cpHot'); H.innerHTML=''; CP.hot=list.map(h=>{ const b=cpEl('button','cph'+(h.ok?' hint':''),h.t||''); b.onclick=()=>h.fn(b); H.append(b); return {b,h}; }); }
function cpBubble(txt){ let b=$cp('cpBub'); if(!b){ b=cpEl('div',null); b.id='cpBub'; document.body.append(b); } b.textContent=txt; b.style.display='block'; CP.bubT=2.2; }
function cpWarn(txt){ // 做錯：提醒（教學同練習都會出）
  if(!CP.warn.includes(txt)) CP.warn.push(txt); const w=$cp('cpWarn'); w.textContent='⚠️ '+txt; w.classList.remove('show'); void w.offsetWidth; w.classList.add('show');
  clearTimeout(CP.wT); CP.wT=setTimeout(()=>w.classList.remove('show'),4200); cpBeep(330,0.25,0.09); vib(80); }
function cpOK(){ cpBeep(880,0.12,0.06); }

/* ---------- 開始／結束 ---------- */
function startCPR(mode,breaths){ ensureAudio(); chModeExit(); sirenSet(false); stopFireworks&&stopFireworks(); show('menu',false); show('result',false); show('over',false);
  S.gm='cpr'; S.mode='cpr'; S.level={id:'CPR',limit:9,tod:'day'}; S.kase={id:'cpr',title:'CPR（測試）',tips:[],steps:[],loc:null};
  cpDrop(); { const L=LMK.plaza; Object.assign(S.car,{x:L.stop[0],z:L.stop[1],v:0}); } resetActors(); setTOD('day'); clearEvents(); ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false;
  Object.assign(CP,{on:true,mode,breaths:!!breaths,helperRun:0,aedOn:0,aedLid:0,shocked:0,warn:[],t:0,comp:0,taps:[],set:0,pads:0,clear:false,dial:'',called:false,aedAsked:false,shoulders:0,shout:false,air:[false,false],brT:0,blow:0,rateWarned:false,jolt:0,amb:0});
  cpDrop(); cpBuild(); amb.visible=false; if(S.camDrag){ S.camDrag.yaw=0; S.camDrag.pitch=0; } document.body.classList.add('cpr'); show('hudWrap',true); cpUI(); $cp('cp').style.display='block';
  // 你喺 14 米外行緊街，佢喺前面
  const V=CP.V, tv=CP.tv; const sx=V[0]+tv[0]*16, sz=V[1]+tv[1]*16; cpPlace(CP.m.me,sx,sz,Math.atan2(-tv[0],-tv[1]),false);
  CP.camMode='walk'; CP.snap=true; cpStep('walk'); }
function cprExit(){ S.gm='ems'; cpMetro(false); if(CP.vo){ cam.clearViewOffset(); CP.vo=0; } $('rName').style.display=''; $('rSave').style.display=''; CP.on=false; cpDrop(); amb.visible=true; document.body.classList.remove('cpr'); const w=$cp('cp'); if(w) w.style.display='none'; const h=$cp('cpHot'); if(h) h.innerHTML='';
  const r=$cp('cpWarn'); if(r) r.classList.remove('show'); const bb=$cp('cpBub'); if(bb) bb.style.display='none'; try{ Object.values(CPV).forEach(a=>a.pause()); }catch(e){} sirenSet(false); }

/* ---------- 步驟 ---------- */
function cpStep(s){ CP.step=s; CP.sub=0; CP.t=0; cpHot([]); const T=CP.mode==='teach';
  if(s==='walk'){ cpSet('🚶 行街','你喺屯門市廣場外面行街，前面有位先生……','你喺屯門市廣場外面行街……',[]); return; }
  if(s==='calm'){ CP.camMode='look';
    cpSet('① 冷靜 Calm','前面嘅先生突然暈低，冇反應！第一步係「冷靜」：先睇清楚現場環境安唔安全（例如有冇車、電線、跌落物），同埋諗吓佢點解會暈低（損傷過程），先好上前。','前面有人突然暈低！你第一步會點做？',[
      {t:'👀 先睇清楚四周環境安唔安全',ok:true,fn:()=>{ cpOK(); CP.camMode='scan'; CP.scanA=0; CP.scan0=Math.atan2(cam.position.x-CP.V[0],cam.position.z-CP.V[1]); cpSet('① 冷靜 Calm','睇緊四周……行人路上冇車駛近、冇電線、冇跌落物，環境安全。','睇緊四周……',[]); }},
      {t:'🏃 即刻衝埋去拍醒佢',fn:()=>cpWarn('未確定環境安全就衝埋去，自己都可能受傷。先冷靜，睇清楚四周有冇危險。')},
      {t:'📱 拎電話出嚟影相',fn:()=>cpWarn('救人要緊，唔好影相。先確定環境安全，再上前檢查。')}]); return; }
  // ② 檢查：先大聲叫 → 再拍膊頭
  if(s==='check'){ CP.camMode='kneel';
    cpSet('② 檢查 1/2：叫佢','先大聲叫佢：「先生，你有冇事呀？」睇佢有冇反應。','先做咩？',[
      {t:'🗣️ 大聲叫：「先生，你有冇事呀？」',ok:true,fn:()=>{ cpOK(); CP.note='🗣️「先生，你有冇事呀？」…… 冇反應。'; cpStep('tap'); }},
      {t:'🤲 用力搖佢個頭',fn:()=>cpWarn('唔好搖病人個頭，佢可能傷咗頸。應該大聲叫佢，再輕拍兩邊膊頭。')},
      {t:'🪑 扶佢坐起身',fn:()=>cpWarn('唔好隨便郁動病人。先大聲叫佢，再輕拍膊頭，確定佢有冇反應。')}]); return; }
  if(s==='tap'){ CP.shoulders=0;
    cpSet('② 檢查 2/2：拍膊頭','冇反應。再輕拍佢兩邊膊頭。撳佢兩邊膊頭。','輕拍佢兩邊膊頭。',[]);
    const sh=b=>{ if(b.dataset.done) return; b.dataset.done=1; b.classList.add('done'); CP.shoulders++; cpOK(); if(CP.shoulders>=2){ cpHot([]); setTimeout(()=>{ if(CP.step==='tap'){ CP.note='冇反應：人事不省！'; cpStep('call'); } },500); } };
    cpHot([{k:'shL',t:'拍',ok:true,fn:sh},{k:'shR',t:'拍',ok:true,fn:sh},{k:'fore',t:'',fn:()=>cpWarn('唔好拍頭。應該輕拍兩邊膊頭。')}]); return; }
  // ③ 召喚：先打 999 → 再叫人攞 AED
  if(s==='call'){ CP.m.hp.visible=true; CP.camMode='helper'; const C=cpKneelSpots().C; cpPlace(CP.m.hp,C.x+CP.u[0]*6+CP.tv[0]*3,C.z+CP.u[1]*6+CP.tv[1]*3,Math.atan2(-CP.u[0],-CP.u[1]),false); CP.m.carry.visible=false;
    cpSet('③ 召喚 Call','佢人事不省！你要留低救人，所以指定旁邊一位途人幫手：叫佢打 999 叫救護車，再去攞 AED，搵唔搵到都要返嚟幫手。要指住一個人、講清楚。','佢冇反應。你會點做？',[
      {t:'👉 指住途人：「你！幫我打 999 叫救護車，再去攞 AED，搵唔搵到都返嚟幫手！」',ok:true,fn:()=>{ cpOK(); cpBubble('好的！'); cpHot([]); $cp('cpAct').innerHTML='';
        setTimeout(()=>{ if(CP.step!=='call') return; CP.helperRun=1; CP.note='途人：「好的！」佢一路打 999，一路去攞 AED。'; cpStep('airway'); },1600); }},
      {t:'📣 對住人群叫：「有冇人幫手呀？」',fn:()=>cpWarn('對住人群叫，大家都以為其他人會幫手。要指住一個人，叫佢打 999、去攞 AED，搵唔搵到都返嚟。')},
      {t:'🏃 自己走開去打電話、搵 AED',fn:()=>cpWarn('唔好留低病人自己走開。叫途人幫你打 999 同攞 AED，你留低準備做 CPR。')},
      {t:'⏳ 等佢自己醒',fn:()=>cpWarn('人事不省唔會自己醒！要即刻叫人打 999 同攞 AED。每遲一分鐘，存活機會跌 7 至 10%。')}]); return; }
  // ④ 打開氣道：先按額頭 → 再托下巴 → 檢查呼吸
  if(s==='airway'){ CP.camMode='kneel';
    cpSet('④ 打開氣道 1/2：按額頭','人事不省時條脷會向後跌，塞住氣道。先用一隻手按住佢額頭。','打開氣道：手放邊度？',[]);
    cpHot([{k:'fore',t:'額頭',ok:true,fn:()=>{ cpOK(); cpStep('chin'); }},{k:'chMid',t:'',fn:()=>cpWarn('未打開氣道、未檢查呼吸，唔好住開始按壓。先按額頭打開氣道。')},{k:'chin',t:'',fn:()=>cpWarn('次序：先用一隻手按住額頭，再用另一隻手托起下巴。')}]); return; }
  if(s==='chin'){
    cpSet('④ 打開氣道 2/2：托下巴','另一隻手托起佢下巴，令個頭向後仰，打開氣道。','另一隻手放邊度？',[]);
    cpHot([{k:'chin',t:'下巴',ok:true,fn:()=>{ cpOK(); cpStep('breath'); }},{k:'chMid',t:'',fn:()=>cpWarn('仲未完成打開氣道。另一隻手托起下巴。')}]); return; }
  if(s==='breath'){ CP.brT=0;
    cpSet('④ 檢查呼吸（少過 10 秒）','望住佢胸口有冇起伏，聽吓有冇呼吸聲，用少過 10 秒判斷有冇「有效」呼吸。只係偶爾喘氣唔算有效呼吸。','檢查呼吸。佢有冇有效呼吸？',[
      {t:'😮‍💨 有正常呼吸',fn:()=>cpWarn('佢胸口完全冇起伏，冇有效呼吸。偶爾喘氣都唔算！應該當心臟停頓，即刻開始 CPR。')},
      {t:'🚫 冇有效呼吸',ok:true,fn:()=>{ if(CP.brT>10) cpWarn('檢查呼吸用咗超過 10 秒。要少過 10 秒就決定，唔好拖延開始 CPR 嘅時間。'); cpOK(); cpStep('hands'); }}]); return; }
  if(s==='hands'){
    cpSet('⑤ 按壓位置','冇有效呼吸 → 確定心臟停頓，即刻做 CPR！先確保佢仰臥喺硬嘅平地上。按壓位置係兩個乳頭連線嘅中央，雙手交疊、手指緊扣，用掌根向下壓。','手放喺邊度按？',[]);
    cpHot([{k:'chUp',t:'',fn:()=>cpWarn('太高喇。按壓位置係兩個乳頭連線嘅中央。')},{k:'chMid',t:'',ok:true,fn:()=>{ cpOK(); cpStep('comp'); }},{k:'belly',t:'',fn:()=>cpWarn('太低喇，按落肚會整傷內臟。按壓位置係兩個乳頭連線嘅中央。')}]); return; }
  if(s==='comp'){ CP.comp=0; CP.taps=[]; CP.rateWarned=false; CP.lastMsg='';
    const after=CP.set===0?'按完 30 下途人就會攞 AED 嚟。':CP.set===1?'按完 30 下救護車就會到。':'';
    cpSet('⑤ 心肺復甦 CPR','跟住「嘀」聲節奏，連續撳「按壓」（或者空白鍵）30 下。快：每分鐘 100 至 120 下；狠：壓落 5 至 6 公分；準：雙手伸直，每下等胸口完全彈返先再壓。'+after,'開始胸外按壓，撳「按壓」或者空白鍵 30 下。',[
      {t:'🫸 按壓',cls:'big',ok:true,fn:()=>cpPress()}]);
    $cp('cpGauge').style.display='flex'; cpGauge(); if(CP.mode==='teach') cpMetro(true); return; }
  if(s==='rescue'){
    cpSet('⑤ 人工呼吸 1/3：按額頭','30 下按壓之後做 2 次人工呼吸。先按額頭打開氣道。','30 下按完。下一步？',[]);
    cpHot([{k:'fore',t:'額頭',ok:true,fn:()=>{ cpOK(); cpStep('rescue2'); }},{k:'chMid',t:'',fn:()=>cpWarn('揀咗 30:2，按完 30 下要先做 2 次人工呼吸：先按額頭打開氣道。')}]); return; }
  if(s==='rescue2'){
    cpSet('⑤ 人工呼吸 2/3：托下巴','另一隻手托起下巴，打開氣道。','另一隻手放邊度？',[]);
    cpHot([{k:'chin',t:'下巴',ok:true,fn:()=>{ cpOK(); cpStep('rescue3'); }}]); return; }
  if(s==='rescue3'){ CP.blow=0;
    cpSet('⑤ 人工呼吸 3/3：吹氣','吹兩啖氣，每啖大約 1 秒，見到胸口升起就得。撳「吹氣」兩次。','吹氣。',[
      {t:'💨 吹氣',ok:true,fn:b=>{ CP.blow++; cpOK(); b.textContent='💨 吹氣（'+CP.blow+' / 2）'; if(CP.blow>=2){ b.disabled=true; setTimeout(()=>{ if(CP.step==='rescue3') cpAfterSet(); },400); } }}]); return; }
  if(s==='aedArrive'){ cpMetro(false); CP.camMode='kneel'; const K=cpKneelSpots(); cpPlace(CP.m.hp,K.hp[0],K.hp[1],Math.atan2(-CP.u[0],-CP.u[1]),true); CP.m.carry.visible=false; CP.m.hp.userData.arms.forEach(x=>x.rotation.x=-0.8);
    const A=CP.m.aed; A.visible=true; aedOpen(A,0); const H=cpW(0.8,2.4,0); A.position.set(H.x,0.12,H.z); A.rotation.y=CP.m.vic.rotation.y;
    cpSet('⑥ AED 到咗','途人攞咗 AED 嚟！呢部 AED 打開機蓋就會自動開機，之後跟住語音一步步做：開機 → 貼電極片 → 分析及電擊。','AED 到咗。',[]);
    cpAED({closed:true,lcd:'',powerHint:true,power:()=>{ if(CP.aedOn) return; CP.aedOn=1; cpOK(); cpSay('on');  setTimeout(()=>{ if(CP.step==='aedArrive'){ cpSay('pads'); cpStep('strip'); } },1700); },
      shock:()=>cpWarn('未開機、未貼電極片，AED 未分析心律，唔可以電擊。先撳綠色掣開機。')}); return; }
  if(s==='strip'){
    cpSet('⑥ 除去上衣','AED 話「將電極片貼喺病人赤裸嘅胸口」。電極片唔可以隔住衫貼：先解開或者剪開病人上衣，露出成個胸口（胸口濕就要抹乾）。','AED 要求貼喺赤裸嘅胸口。下一步？',[
      {t:'✂️ 剪開／解開上衣，露出胸口',ok:true,fn:()=>{ cpOK(); CP.m.vp.userData.shirt.visible=false; CP.note='上衣已經剪開，露出胸口。'; cpStep('pads'); }},
      {t:'🩹 隔住件衫貼電極片',fn:()=>cpWarn('電極片唔可以隔住衫貼，電流過唔到！要先解開或者剪開上衣，貼喺赤裸、乾爽嘅皮膚。')},
      {t:'🧍 扶病人坐起身除衫',fn:()=>cpWarn('唔好扶病人起身除衫，會延誤電擊同按壓。直接解開或者剪開上衣就得。')}]);
    cpAED({lcd:'將電極片貼喺病人赤裸嘅胸口',shock:()=>cpWarn('電極片未貼好，AED 未分析心律，唔可以電擊。')}); return; }
  if(s==='pads'){
    cpSet('⑥ 貼電極片 1/2','撕開電極片，按片上面嘅圖示，貼喺病人赤裸、乾爽嘅皮膚。第一塊：病人右邊鎖骨下面、胸骨右側（即係你望落去嘅左手邊）。','貼第一塊電極片。',[]);
    cpAED({lcd:'將電極片貼喺病人赤裸嘅胸口',info:'第一塊：病人右邊鎖骨下面、胸骨右側。',pad:1,shock:()=>cpWarn('電極片未貼好，AED 未分析心律，唔可以電擊。')});
    cpHot([{k:'padA',t:'',ok:true,fn:()=>{ cpOK(); cpPad('padA'); cpStep('pads2'); }},
      {k:'padX',t:'',fn:()=>cpWarn('呢度係病人左邊。第一塊貼病人「右邊」鎖骨下面、胸骨右側（即係你望落去嘅左手邊）。')},
      {k:'padZ',t:'',fn:()=>cpWarn('唔啱。第一塊貼病人右邊鎖骨下面、胸骨右側。')},
      {k:'padY',t:'',fn:()=>cpWarn('唔好貼喺肚。第一塊貼病人右邊鎖骨下面。')}]); return; }
  if(s==='pads2'){
    cpSet('⑥ 貼電極片 2/2','第二塊：病人左邊胸側，喺腋下中間嗰條線、乳頭水平以下，要貼得夠側（直放）。咁電流先會斜斜穿過心臟。','貼第二塊電極片。',[]);
    cpAED({lcd:'將電極片貼喺病人赤裸嘅胸口',info:'第二塊：病人左邊胸側、腋下中間，乳頭水平以下。',pad:2,shock:()=>cpWarn('電極片未貼好，AED 未分析心律，唔可以電擊。')});
    cpHot([{k:'padB',t:'',ok:true,fn:()=>{ cpOK(); cpPad('padB'); cpHot([]); setTimeout(()=>{ if(CP.step==='pads2') cpStep('analyse'); },700); }},
      {k:'padZ',t:'',fn:()=>cpWarn('太入喇！第二塊唔係貼喺胸口前面，要貼喺左邊胸側、腋下中間嗰條線，乳頭水平以下。')},
      {k:'padX',t:'',fn:()=>cpWarn('太高喇。第二塊貼病人左邊胸側、腋下中間，乳頭水平以下。')},
      {k:'padY',t:'',fn:()=>cpWarn('唔好貼喺肚。第二塊貼病人左邊胸側、腋下中間，乳頭水平以下。')}]); return; }
  if(s==='analyse'){ cpSay('analyse'); CP.clear=false;
    cpSet('⑦ 分析心律','AED 正在分析心律。分析期間唔好接觸病人，郁動會影響分析。等佢講完。','AED 分析緊……',[
      {t:'🫸 按壓',fn:()=>{ cpSay('notouch'); cpWarn('分析心律期間唔好接觸病人！停手等 AED 分析完。'); }}]);
    cpAED({lcd:'正在分析心律，請勿接觸病人',done:1,shock:()=>cpWarn('AED 仲分析緊，未建議電擊。等佢分析完。')}); return; }
  if(s==='shock'){ cpSay('shock'); cpHelperTouch(true);
    cpSet('⑦ 電擊 1/2：叫人離開','AED 建議電擊！途人仲掂住病人。電擊前一定要大聲叫「全部人離開！」，望清楚冇人接觸病人。','AED 建議電擊。下一步？',[
      {t:'🗣️ 大聲叫：「全部人離開！」',ok:true,fn:()=>{ cpOK(); cpHelperTouch(false); cpStep('shock2'); }}]);
    cpAED({lcd:'建議電擊，請離開病人',done:1,shock:()=>cpWarn('仲有人掂住病人！電擊前要大聲叫「全部人離開」，確定冇人接觸先可以電擊。')}); return; }
  if(s==='shock2'){
    cpSet('⑦ 電擊 2/2：撳電擊掣','冇人接觸病人，撳 AED 上面閃動嘅橙色電擊掣。','撳電擊掣。',[]);
    cpAED({lcd:'按閃動嘅電擊掣',done:1,flash:true,shock:()=>{ if(CP.shocked) return; CP.shocked=1; cpShock(); }}); return; }
  if(s==='amb'){ cpMetro(false); CP.camMode='amb'; CP.amb=0;
    const st=LMK.plaza.stop, tv=CP.tv; amb.visible=true; amb.position.set(st[0]-tv[0]*60,0.12,st[1]-tv[1]*60); amb.rotation.y=Math.atan2(tv[0],tv[1]); sirenSet(true);
    cpSet('🚑 救護車到場','救護員到場喇！繼續按壓直至救護員接手。','救護員到場喇！',[]); return; }
  if(s==='end'){ cpEnd(); return; }
}
// 畫面下方嘅 AED 機（2D）：顯示屏、綠色開機掣、橙色電擊掣；貼片步驟會顯示電極片
function cpAED(o){ const A=$cp('cpAct'); const d=cpEl('div','aedui'+(o.closed?' closed':''));
  if(o.closed){ const lidv=cpEl('div','aedlid'); lidv.innerHTML='<div class="h"></div><div class="lg">♡⚡</div><b>AED</b>'; const op=cpEl('button','aedopen'+(o.powerHint?' hint':''),'⬆ 打開機蓋（自動開機）'); op.onclick=o.power; lidv.append(op);
    const sh=cpEl('button','cpb','⚡ 搵電擊掣'); sh.onclick=o.shock; d.append(lidv); A.append(d,sh); CP.aedLcd=cpEl('span'); return; }
  const face=cpEl('div','aedface'); const sp=cpEl('div','aedspk'); const sc=cpEl('img','aedscr'); sc.src=AEDT.scr.image.toDataURL();
  const vo=cpEl('div','aedvo','🔊 '+(o.lcd||'')); const rd=cpEl('i','aedrdy on');
  const ib=cpEl('button','aedi','i'); ib.onclick=()=>{ $cp('cpTxt').textContent=o.info||'跟住 AED 語音指示做。'; };
  const sh=cpEl('button','aedshk'+(o.flash?' flash':'')+(o.flash?' hint':'')); sh.innerHTML='<b>⚡</b>'; sh.onclick=()=>{ o.shock?o.shock():null; };
  face.append(vo,sp,sc,ib,rd,sh); d.append(face);
  if(o.pad){ const pr=cpEl('div','aedpads'); [1,2].forEach(n=>{ const im=cpEl('img','aedpad'+(n===o.pad?' on':'')+(n<o.pad?' used':'')); im.src=PADT[n].image.toDataURL(); pr.append(im); }); d.append(pr); }
  A.append(d); CP.aedLcd=vo; }
function cpDialUI(){ const A=$cp('cpAct'); A.innerHTML='';
  const ph=cpEl('div','cpphone'); const scr=cpEl('div','cpscr',CP.dial||'撥號'); ph.append(scr); const pad=cpEl('div','cppad');
  ['1','2','3','4','5','6','7','8','9','⌫','0','📞'].forEach(k=>{ const b=cpEl('button','cpk'+(k==='📞'?' call':''),k); if(CP.mode==='teach'&&(k==='9'||k==='📞')) b.classList.add('hint');
    b.onclick=()=>{ if(CP.called) return; if(k==='⌫') CP.dial=CP.dial.slice(0,-1); else if(k==='📞'){ if(CP.dial==='999'){ CP.called=true; cpOK(); CP.note='📞 已經打 999 叫咗救護車。'; setTimeout(()=>{ if(CP.step==='call') cpStep('askAED'); },600); } else cpWarn(CP.dial===''?'要先撥號：香港緊急求助電話係 999。':'撥錯號碼喇！香港緊急求助電話係 999。'); CP.dial=CP.called?'999 通話中':''; }
      else if(CP.dial.length<6) CP.dial+=k; scr.textContent=CP.dial||'撥號'; cpBeep(700+(+k||0)*30,0.06,0.05); }; pad.append(b); });
  ph.append(pad); A.append(ph);
  const wait=cpEl('button','cpb','⏳ 等佢自己醒'); wait.onclick=()=>cpWarn('人事不省唔會自己醒！要即刻打 999，同埋叫人攞 AED。每遲一分鐘，存活機會跌 7 至 10%。'); A.append(wait); }
function cpPress(){ const now=performance.now()/1000; if(CP.step!=='comp') return; CP.comp++; CP.taps.push(now); if(CP.taps.length>7) CP.taps.shift(); CP.jolt=1; cpBeep(220,0.05,0.04); vib(15);
  cpGauge(); const r=cpRate();
  if(r&&CP.comp>=6){ const msg=r<100?'太慢喇，要快啲（每分鐘 100 至 120 下）':r>120?'太快喇，慢少少（每分鐘 100 至 120 下），等胸口完全彈返':'';
    if(CP.mode==='teach'){ $cp('cpTxt').textContent=msg||'節奏啱啱好！保持每分鐘 100 至 120 下，雙手伸直。'; }
    else if(msg&&CP.comp>=10&&!CP.rateWarned){ CP.rateWarned=true; cpWarn(msg); } }
  if(CP.comp>=30){ cpMetro(false); setTimeout(()=>{ if(CP.step!=='comp') return; if(CP.breaths) cpStep('rescue'); else cpAfterSet(); },350); } }
function cpRate(){ const T=CP.taps; if(T.length<4) return 0; const d=(T[T.length-1]-T[0])/(T.length-1); return d>0?60/d:0; }
function cpGauge(){ const r=Math.round(cpRate()); $cp('cpRate').textContent=r||'--'; $cp('cpCnt').textContent=CP.comp+' / 30';
  const b=$cp('cpBar'); const f=Math.max(0,Math.min(1,(r-60)/100)); b.style.width=(f*100)+'%'; b.style.background=r>=100&&r<=120?'#2fb36d':r?'#ff9f1c':'#ccc'; }
function cpAfterSet(){ CP.set++; if(CP.set===1) cpStep('aedArrive'); else cpStep('amb'); }
function cpPad(key){ const n=key==='padA'?1:2; const Q=PADPOSE[key], vp=CP.m.vp;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(0.15,0.2),new THREE.MeshStandardMaterial({map:PADT[n],roughness:0.75,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide}));
  m.position.set(...Q.p); m.rotation.set(0,Q.ry,Q.rz); vp.add(m); CP.m.pads.push(m);
  // 電線：由 AED 插頭拉去電極片頂
  const P=new THREE.Vector3(Q.p[0],Q.p[1]+0.1,Q.p[2]); vp.localToWorld(P); const A=CP.m.aed, pt=new THREE.Vector3(); A.userData.port.getWorldPosition(pt);
  const mid=pt.clone().lerp(P,0.5); mid.y=0.16; const curve=new THREE.CatmullRomCurve3([pt,new THREE.Vector3(pt.x,0.14,pt.z).lerp(mid,0.35),mid,P]);
  const w=new THREE.Mesh(new THREE.TubeGeometry(curve,28,0.014,6,false),M(n===1?0x8fb7ef:0xe9edf2,{r:0.5})); scene.add(w); CP.m.pads.push(w);
}
function raiseArm(pp,i,on){ const a=pp.userData.arms[i]; if(a.userData.y0===undefined){ a.userData.y0=a.position.y; a.userData.x0=a.position.x; }   // 舉高隻手：手臂移到膊頭上面、垂直向上
  if(on){ a.position.y=a.userData.y0+1.25; a.position.x=a.userData.x0*1.4; a.rotation.set(0,0,(a.userData.x0>0?-1:1)*0.22); } else { a.position.y=a.userData.y0; a.position.x=a.userData.x0; a.rotation.z=0; } }
function cpHelperTouch(on){ const K=cpKneelSpots(), hp=CP.m.hp; if(on){ cpPlace(hp,K.hp[0],K.hp[1],Math.atan2(-CP.u[0],-CP.u[1]),true); raiseArm(hp,1,false); hp.userData.arms.forEach(a=>a.rotation.x=-1.4); }
  else { cpPlace(hp,K.hp[0]+CP.u[0]*1.3,K.hp[1]+CP.u[1]*1.3,Math.atan2(-CP.u[0],-CP.u[1]),false); hp.userData.arms[0].rotation.x=-0.3; raiseArm(hp,1,true); } }   // 退後、舉手示意其他人唔好埋嚟
function cpShock(){ cpHot([]); $cp('cpAct').innerHTML=''; CP.jolt=2.2; cpBeep(160,0.5,0.15); const f=$cp('cpWarn'); document.body.classList.add('cpflash'); setTimeout(()=>document.body.classList.remove('cpflash'),180);
  setTimeout(()=>{ cpSay('done');  },500); setTimeout(()=>{ if(CP.step==='shock2'){ raiseArm(CP.m.me,0,false); raiseArm(CP.m.hp,1,false); cpStep('comp'); } },2600); }
function cpEnd(){ cpMetro(false); sirenSet(false); const w=$cp('cp'); w.style.display='none'; cpHot([]);
  $('rTitle').textContent=CP.mode==='teach'?'教學完成':'練習完成'; $('rStars').textContent=''; $('rTime').textContent='救護員已經接手';
  $('rNote').textContent=CP.warn.length?('今次有 '+CP.warn.length+' 個地方要留意：'):'全部步驟正確，做得好！記住：冷靜 → 檢查 → 召喚 → CPR + AED。';
  const ul=$('rTips'); ul.innerHTML=''; (CP.warn.length?CP.warn:['冷靜：確定現場環境安全','檢查：輕拍膊頭、大聲叫，確定人事不省','召喚：指定途人打 999、攞 AED，搵唔搵到都返嚟','CPR：每分鐘 100–120 下，壓 5–6 公分，完全回彈','AED：開機 → 貼電極片 → 分析及電擊，分析同電擊時唔好掂病人']).forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ul.append(li); });
  $('rAch').innerHTML=''; $('rNext').style.display='none'; $('rName').style.display='none'; $('rSave').style.display='none'; show('result',true); show('hudWrap',false); S.mode='result'; }

/* ---------- 每格更新 ---------- */
function cprTick(dt,t){ if(!CP.on) return; CP.t+=dt; const me=CP.m.me, vp=CP.m.vp, V=CP.V, tv=CP.tv;
  if(CP.step==='walk'){ // 行近；第 2.2 秒佢暈低
    const tx=V[0]+tv[0]*9, tz=V[1]+tv[1]*9; const dx=tx-me.position.x, dz=tz-me.position.z, d=Math.hypot(dx,dz);
    if(d>0.2){ me.position.x+=dx/d*Math.min(d,2.6*dt); me.position.z+=dz/d*Math.min(d,2.6*dt); const w=Math.sin(t*9)*0.5; me.userData.legL.rotation.x=w; me.userData.legR.rotation.x=-w; }
    else { me.userData.legL.rotation.x=me.userData.legR.rotation.x=0; }
    if(CP.t>2.2&&vp.userData.stand){ vp.userData.fall=(vp.userData.fall||0)+dt*2.2; const f=Math.min(1,vp.userData.fall); vp.rotation.x=-Math.PI/2*f*f; vp.position.y=MKY*MK*f;
      if(f>=1){ cpLay(); cpBeep(140,0.25,0.12); CP.calmAt=CP.t+0.8; } }
    if(!vp.userData.stand&&CP.calmAt&&CP.t>CP.calmAt){ CP.calmAt=0; cpStep('calm'); } }
  if(CP.camMode==='scan'){ CP.scanA+=dt*2.6; if(CP.scanA>=Math.PI*2){ CP.camMode='go'; } }
  if(CP.camMode==='go'){ // 行埋去跪低
    const K=cpKneelSpots(); const dx=K.me[0]-me.position.x, dz=K.me[1]-me.position.z, d=Math.hypot(dx,dz);
    if(d>0.25){ me.position.x+=dx/d*Math.min(d,4*dt); me.position.z+=dz/d*Math.min(d,4*dt); me.rotation.y=Math.atan2(dx,dz); const w=Math.sin(t*11)*0.6; me.userData.legL.rotation.x=w; me.userData.legR.rotation.x=-w; }
    else { cpPlace(me,K.me[0],K.me[1],Math.atan2(CP.u[0],CP.u[1]),true); me.userData.arms.forEach(a=>a.rotation.x=-1.2); cpStep('check'); } }
  // 途人跑去攞 AED
  if(CP.helperRun&&CP.step!=='aedArrive'&&CP.set===0){ const hp=CP.m.hp; const away=[V[0]-tv[0]*40,V[1]-tv[1]*40]; const dx=away[0]-hp.position.x, dz=away[1]-hp.position.z, d=Math.hypot(dx,dz);
    if(d>0.5){ hp.position.x+=dx/d*6*dt; hp.position.z+=dz/d*6*dt; hp.rotation.y=Math.atan2(dx,dz); hp.userData.arms[1].rotation.x=-2.7; const w=Math.sin(t*13)*0.7; hp.userData.legL.rotation.x=w; hp.userData.legR.rotation.x=-w; } else hp.visible=false; }
  if(CP.step==='aedArrive') CP.m.hp.visible=true;
  if(CP.step==='call'&&CP.m.hp.visible){ const hp=CP.m.hp; hp.rotation.y=Math.atan2(me.position.x-hp.position.x,me.position.z-hp.position.z); }
  if(CP.step==='breath') CP.brT+=dt;
  if(CP.bubT>0){ CP.bubT-=dt; const b=$cp('cpBub'); const H=CP.m.hp.position, v=new THREE.Vector3(H.x,3.6,H.z).project(cam); b.style.left=((v.x+1)/2*innerWidth)+'px'; b.style.top=((1-v.y)/2*innerHeight)+'px'; if(CP.bubT<=0) b.style.display='none'; }
  { const A=CP.m.aed; if(A&&A.visible){ if(CP.aedOn&&CP.aedLid<1){ CP.aedLid=Math.min(1,CP.aedLid+dt*2.2); aedOpen(A,CP.aedLid); }
    A.userData.led.material.color.setHex(CP.aedOn?0x33ff66:0x1d3a24); A.userData.shk.material.color.setHex(CP.step==='shock2'&&!CP.shocked&&Math.floor(t*4)%2?0xffd060:0xb4560a); } }
  if(CP.step==='analyse'&&CP.t>4.6){ cpStep('shock'); }
  // 按壓動畫
  if(CP.jolt>0){ CP.jolt=Math.max(0,CP.jolt-dt*7); }
  else if(CP.jolt<0){ CP.jolt=Math.min(0,CP.jolt+dt*2); }
  const press=CP.step==='comp'?Math.max(0,CP.jolt):0;
  if(CP.step==='analyse'||CP.step==='shock'||CP.step==='shock2'){ const K=cpKneelSpots(), u=CP.u, clr=CP.step==='shock2';
    me.position.x=K.me[0]-u[0]*0.9; me.position.z=K.me[1]-u[1]*0.9; raiseArm(me,0,clr); if(!clr) me.userData.arms[0].rotation.x=-0.2; me.userData.arms[1].rotation.x=-0.2; }   // 分析同電擊：雙手離開病人；叫完離開就退後舉手
  else if(CP.step==='pads'||CP.step==='pads2'||CP.step==='strip'){ const K=cpKneelSpots(); me.position.x=K.me[0]; me.position.z=K.me[1]; me.userData.arms.forEach(a=>a.rotation.x=-1.2); }
  const handsOn=CP.step==='comp'||CP.step==='amb'; me.visible=!handsOn; const HN=CP.m.hands;
  if(HN){ HN.visible=handsOn; if(handsOn){ const C=cpW(0,1.86,0.15+0.02); const f=cpW(0,1.86,0.15).sub(cpW(0,1.86,0)).normalize();
    HN.position.set(C.x,C.y-press*0.06,C.z); HN.rotation.y=Math.atan2(CP.u[0],CP.u[1]); /* 手指橫跨胸口、手臂向救人者嗰邊 */ } }
  const tor=vp.userData.torso; if(tor) tor.scale.z=1-press*0.2;
  if(CP.step==='shock2'||CP.jolt>1.2){ if(CP.jolt>1){ vp.position.y=MKY*MK+Math.sin(t*60)*0.06*(CP.jolt-1); } else if(!vp.userData.stand) vp.position.y=MKY*MK; }
  if(CP.step==='amb'){ CP.amb+=dt; const st=LMK.plaza.stop; const tx=st[0]-tv[0]*6, tz=st[1]-tv[1]*6; const dx=tx-amb.position.x, dz=tz-amb.position.z, d=Math.hypot(dx,dz);
    if(d>0.3){ const v=Math.min(14,d*1.4); amb.position.x+=dx/d*v*dt; amb.position.z+=dz/d*v*dt; }
    // 救護車到之前繼續按（自動節奏）
    if(Math.floor(CP.amb*1.83)!==Math.floor((CP.amb-dt)*1.83)) CP.jolt=1;
    if(CP.amb>6.5) cpStep('end'); }
  // 熱點跟住 3D 位置
  if(CP.hot.length){ const v=new THREE.Vector3(); CP.hot.forEach(({b,h})=>{ const P=cpW(...CPPT[h.k]); v.copy(P).project(cam); b.style.left=((v.x+1)/2*innerWidth)+'px'; b.style.top=((1-v.y)/2*innerHeight)+'px'; }); }
}
function cprCam(dt,t){ const V=CP.V, u=CP.u, tv=CP.tv, me=CP.m.me; if(!V) return; const portrait=innerWidth<innerHeight; let P,Lk;
  // 下面有說明卡：將畫面中心向上移，主角唔會俾卡遮住
  const off=Math.round(innerHeight*(portrait?0.24:0.16)), vk=off+'x'+innerWidth; if(CP.vo!==vk){ CP.vo=vk; cam.setViewOffset(innerWidth,innerHeight,0,off,innerWidth,innerHeight); }
  const C=cpW(...CPPT.chMid);
  if(CP.camMode==='walk'||CP.camMode==='look'){ const fx=V[0]-me.position.x, fz=V[1]-me.position.z, d=Math.hypot(fx,fz)||1;
    P=new THREE.Vector3(me.position.x-fx/d*6-u[0]*2.5,6.5,me.position.z-fz/d*6-u[1]*2.5); Lk=new THREE.Vector3(V[0],0.8,V[1]); }
  else if(CP.camMode==='kneel'&&CP.step==='shock2'){ P=new THREE.Vector3(C.x-tv[0]*10.5,4.6,C.z-tv[1]*10.5); Lk=new THREE.Vector3(C.x+tv[0]*0.6,1.9,C.z+tv[1]*0.6); }   // 電擊：低角度拉闊，見到所有人退後舉手
  else if(CP.camMode==='scan'){ const a=CP.scan0+CP.scanA; P=new THREE.Vector3(V[0]+Math.sin(a)*9,10,V[1]+Math.cos(a)*9); Lk=new THREE.Vector3(V[0],0.6,V[1]); }   // 高啲睇落嚟，唔俾樹遮
  else if(CP.camMode==='helper'){ const H=CP.m.hp.position, mp=me.position; const dx=H.x-mp.x, dz=H.z-mp.z, d=Math.hypot(dx,dz)||1;
    P=new THREE.Vector3(mp.x-dx/d*2.5,5.5,mp.z-dz/d*2.5); Lk=new THREE.Vector3(H.x,1.4,H.z); }   // 轉去望住途人
  else if(CP.camMode==='go'){ P=new THREE.Vector3(C.x-tv[0]*3.5,9.5,C.z-tv[1]*3.5); Lk=new THREE.Vector3(C.x,0.5,C.z); }   // 由上面跟住行埋去，唔俾樹遮
  else if(CP.camMode==='amb'){ P=new THREE.Vector3(C.x-u[0]*11-tv[0]*6,13,C.z-u[1]*11-tv[1]*6); Lk=new THREE.Vector3(C.x-u[0]*4+tv[0]*2,0.8,C.z-u[1]*4+tv[1]*2); }
  else { const k=(portrait?1.12:1)*1, pl=cpW(1,1.86,0).sub(cpW(0,1.86,0)).setY(0).normalize(); P=new THREE.Vector3(C.x-tv[0]*1.5*k+pl.x*1.5,4.3*k,C.z-tv[1]*1.5*k+pl.z*1.5); Lk=new THREE.Vector3(C.x+tv[0]*0.45,0.2,C.z+tv[1]*0.45); }   // 差唔多正上方睇落胸口，頭喺上面   // 由腳嗰邊斜斜睇落去，救護員喺側邊唔會遮住
  { const D=S.camDrag; if(D&&(D.yaw||D.pitch)){ const v=P.clone().sub(Lk), c=Math.cos(D.yaw), sn=Math.sin(D.yaw); const x=v.x*c+v.z*sn, z=-v.x*sn+v.z*c; v.x=x; v.z=z;   // 拉畫面：圍住目標轉
    const hz=Math.hypot(v.x,v.z), L=v.length(); const el=Math.max(0.15,Math.min(1.45,Math.atan2(v.y,hz)+D.pitch*0.8)); v.y=Math.sin(el)*L; const k=Math.cos(el)*L/(hz||1); v.x*=k; v.z*=k; P=Lk.clone().add(v); } }
  if(CP.snap){ CP.snap=false; cam.position.copy(P); camLook.copy(Lk); return; }
  cam.position.lerp(P,Math.min(1,dt*(CP.camMode==='scan'?10:3.5))); camLook.lerp(Lk,Math.min(1,dt*4)); }
// 電腦：空白鍵按壓
addEventListener('keydown',e=>{ if(CP.on&&CP.step==='comp'&&(e.code==='Space'||e.key===' ')){ e.preventDefault(); if(!e.repeat) cpPress(); } });
window.__CP=CP; window.__cpStep=cpStep; window.__startCPR=startCPR;

/* ---------- 城市動物：行人路上嘅貓、狗、白鴿、麻雀（郊區有黃牛）、河／湖上嘅鴨仔、天上嘅麻鷹同飛機 ----------
   慳效能：每隻動物大部分砌埋做一個網格（vertex color），用完放返入池；離開視野就自己收返。 */
const ANI_DEF={on:true,ground:8,ducks:3,plane:true,kite:true,types:{cat:true,dog:true,pigeon:true,sparrow:true,cow:true}};
const ANI=(()=>{
  let CFG=(()=>{ const v=store.get('ani',null)||{}; if(!store.get('aniV2',false)){ if(v.ground===4) v.ground=8; if(v.ducks===2) v.ducks=3; store.set('aniV2',true); } return Object.assign({},ANI_DEF,v,{types:Object.assign({},ANI_DEF.types,v.types||{})}); })();
  const MAT=new THREE.MeshLambertMaterial({vertexColors:true}), MATNF=new THREE.MeshLambertMaterial({vertexColors:true}); MATNF.fog=false;
  const BX=new THREE.BoxGeometry(1,1,1), SP=new THREE.SphereGeometry(1,8,6), CN=new THREE.ConeGeometry(1,1,5), CY=new THREE.CylinderGeometry(1,1,1,8);
  const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _c=new THREE.Color(), _p=new THREE.Vector3(), _s=new THREE.Vector3();
  // parts: [geo, 顏色, [x,y,z], [sx,sy,sz], [rx,ry,rz]]
  function merge(parts){ const pos=[],nor=[],col=[];
    for(const [geo,hex,p,s,r] of parts){ const g=geo.index?geo.toNonIndexed():geo.clone(); _e.set(...(r||[0,0,0])); _q.setFromEuler(_e); _m.compose(_p.set(...p),_q,_s.set(...s)); g.applyMatrix4(_m); _c.setHex(hex);
      const P=g.attributes.position, N=g.attributes.normal; for(let i=0;i<P.count;i++){ pos.push(P.getX(i),P.getY(i),P.getZ(i)); nor.push(N.getX(i),N.getY(i),N.getZ(i)); col.push(_c.r,_c.g,_c.b); } g.dispose(); }
    const G=new THREE.BufferGeometry(); G.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); G.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3)); G.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); G.computeBoundingSphere(); return G; }
  const GC={}; const geo=(k,f)=>GC[k]||(GC[k]=f());
  const mesh=(G,mat=MAT)=>{ const m=new THREE.Mesh(G,mat); m.matrixAutoUpdate=true; return m; };
  // 腳：頂部做轉軸
  const legGeo=(k,w,h,d,hex)=>geo(k,()=>merge([[BX,hex,[-w/2,-h/2,0],[w*0.4,h,d]],[BX,hex,[w/2,-h/2,0],[w*0.4,h,d]],[BX,hex,[-w/2,-h+0.03,0.03],[w*0.42,0.06,d*1.3]],[BX,hex,[w/2,-h+0.03,0.03],[w*0.42,0.06,d*1.3]]]));   // 兩隻腳＋腳掌，頂部係轉軸

  /* ----- 模型 ----- */
  const CATC=[[0xe8963c,0xf6d2a2],[0x2b2b30,0x2b2b30],[0xd9d6cf,0x8a8580],[0x8a6a50,0xe6d6c0]];
  function cat(v){ const [a,b]=CATC[v], g=new THREE.Group();
    g.add(mesh(geo('cat'+v,()=>merge([[BX,a,[0,0.5,0],[0.38,0.34,0.85]],[BX,b,[0,0.42,0.12],[0.3,0.12,0.5]],[SP,a,[0,0.78,0.5],[0.25,0.23,0.24]],[SP,b,[0,0.72,0.68],[0.1,0.08,0.08]],
      [CN,a,[-0.12,1.0,0.48],[0.08,0.16,0.08]],[CN,a,[0.12,1.0,0.48],[0.08,0.16,0.08]],[SP,0x3b8f3b,[-0.09,0.82,0.72],[0.04,0.05,0.03]],[SP,0x3b8f3b,[0.09,0.82,0.72],[0.04,0.05,0.03]],
      [BX,a,[0,0.8,-0.56],[0.08,0.08,0.58],[0.95,0,0]]]))));
    const lF=mesh(legGeo('catL'+v,0.3,0.4,0.1,a)), lB=mesh(legGeo('catL'+v,0.3,0.4,0.1,a)); lF.position.set(0,0.4,0.3); lB.position.set(0,0.4,-0.3); g.add(lF,lB); g.userData={lF,lB,h:1}; return g; }
  const DOGC=[[0xb9824a,0xe9cfa6],[0xe9dcc0,0xcbb894],[0x3a3330,0xb9824a]];
  function dog(v){ const [a,b]=DOGC[v], g=new THREE.Group();
    g.add(mesh(geo('dog'+v,()=>merge([[BX,a,[0,0.72,0],[0.5,0.45,1.15]],[BX,b,[0,0.6,0.15],[0.42,0.2,0.7]],[BX,a,[0,1.08,0.72],[0.42,0.4,0.46]],[BX,b,[0,0.98,1.02],[0.24,0.2,0.26]],[SP,0x1a1a1a,[0,1.04,1.16],[0.06,0.05,0.04]],
      [BX,a,[-0.17,1.33,0.66],[0.1,0.22,0.1],[0,0,0.25]],[BX,a,[0.17,1.33,0.66],[0.1,0.22,0.1],[0,0,-0.25]],[BX,a,[0,0.98,-0.74],[0.09,0.09,0.5],[0.75,0,0]]]))));
    const lF=mesh(legGeo('dogL'+v,0.4,0.6,0.14,a)), lB=mesh(legGeo('dogL'+v,0.4,0.6,0.14,a)); lF.position.set(0,0.6,0.4); lB.position.set(0,0.6,-0.4); g.add(lF,lB); g.userData={lF,lB,h:1}; return g; }
  function cow(){ const a=0xb27a3e, g=new THREE.Group();
    g.add(mesh(geo('cow',()=>merge([[BX,a,[0,1.3,0],[0.9,0.8,1.8]],[BX,a,[0,1.6,1.15],[0.5,0.5,0.62]],[BX,0x3a2a20,[0,1.5,1.48],[0.4,0.26,0.1]],[CN,0xe8e0cc,[-0.3,1.95,1.1],[0.06,0.3,0.06],[0,0,0.9]],[CN,0xe8e0cc,[0.3,1.95,1.1],[0.06,0.3,0.06],[0,0,-0.9]],
      [BX,a,[0,1.28,-0.93],[0.07,0.8,0.07],[0.15,0,0]],[BX,0x3a2a20,[0,0.86,-0.99],[0.12,0.16,0.12]],[BX,0xc79a62,[0,0.95,0],[0.7,0.1,1.2]]]))));
    const lF=mesh(legGeo('cowL',0.7,0.92,0.22,a)), lB=mesh(legGeo('cowL',0.7,0.92,0.22,a)); lF.position.set(0,0.92,0.65); lB.position.set(0,0.92,-0.65); g.add(lF,lB); g.userData={lF,lB,h:1}; return g; }
  // 雀：身＋頭＋嘴砌埋；翼另外一塊（飛先見到）
  const BIRD={pigeon:[0x8d94a3,0x5d6878,0x6a7a8c,1.6],sparrow:[0x8a6a48,0x5a3f2a,0xb79a78,1.0]};
  function bird(k){ const [a,h,w,sc]=BIRD[k], b=new THREE.Group();
    b.add(mesh(geo('b'+k,()=>merge([[SP,a,[0,0.2,0],[0.16,0.15,0.24]],[SP,h,[0,0.36,0.17],[0.1,0.1,0.1]],[CN,0xd9a441,[0,0.35,0.29],[0.035,0.1,0.035],[Math.PI/2,0,0]],[BX,h,[0,0.24,-0.26],[0.12,0.03,0.16]]]))));
    const wing=mesh(geo('bw'+k,()=>merge([[BX,w,[-0.22,0.27,0],[0.36,0.02,0.18]],[BX,w,[0.22,0.27,0],[0.36,0.02,0.18]]]))); wing.visible=false; b.add(wing); b.userData={wing}; b.scale.setScalar(sc); return b; }
  function flock(k,n){ const g=new THREE.Group(), bs=[]; for(let i=0;i<n;i++){ const b=bird(k); g.add(b); bs.push(b); } g.userData={bs,h:1}; return g; }
  function duck(young){ return mesh(geo(young?'dkY':'dk',()=>young?merge([[SP,0xffd84a,[0,0.12,0],[0.17,0.13,0.24]],[SP,0xffd84a,[0,0.27,0.16],[0.1,0.1,0.1]],[BX,0xf08a24,[0,0.26,0.28],[0.07,0.03,0.08]]])
      :merge([[SP,0x8a6a4a,[0,0.15,0],[0.3,0.22,0.45]],[SP,0xe9e2d0,[0,0.1,0.05],[0.27,0.12,0.38]],[SP,0x1f6b3a,[0,0.44,0.3],[0.16,0.16,0.16]],[BX,0xf2f2f2,[0,0.3,0.3],[0.2,0.04,0.12]],[BX,0xf0a020,[0,0.41,0.5],[0.12,0.05,0.16]],[BX,0x3a3a3a,[0,0.24,-0.42],[0.14,0.06,0.14],[0.5,0,0]]]))); }
  function family(){ const g=new THREE.Group(), ds=[duck(false)]; const n=2+(Math.random()*3|0); for(let i=0;i<n;i++) ds.push(duck(true)); ds.forEach((d,i)=>{ d.position.set((i%2?0.35:-0.35)*(i>0),0,-i*0.9); g.add(d); }); g.userData={ds,h:1}; return g; }
  function plane(){ const g=new THREE.Group(), W=0xf4f6f8, B=0x1f5fa8;
    g.add(mesh(geo('plane',()=>merge([[CY,W,[0,0,0],[1.6,16,1.6],[Math.PI/2,0,0]],[SP,W,[0,0,8],[1.6,1.6,2.6]],[CN,W,[0,0.3,-10],[1.6,4,1.6],[-Math.PI/2,0,0]],
      [BX,0xdfe3e8,[-5.6,-0.5,0],[11.5,0.35,3.2],[0,-0.38,0]],[BX,0xdfe3e8,[5.6,-0.5,0],[11.5,0.35,3.2],[0,0.38,0]],[BX,0xdfe3e8,[-2.2,0.4,-10],[4.4,0.3,1.6],[0,-0.45,0]],[BX,0xdfe3e8,[2.2,0.4,-10],[4.4,0.3,1.6],[0,0.45,0]],[BX,B,[0,2.6,-10],[0.3,4.2,2.8]],[BX,B,[0,-0.2,0],[1.62,0.35,16.2]],
      [CY,0xb8bec6,[-5,-1.4,2.2],[0.7,2.6,0.7],[Math.PI/2,0,0]],[CY,0xb8bec6,[5,-1.4,2.2],[0.7,2.6,0.7],[Math.PI/2,0,0]],[BX,0x27313d,[0,0.55,7.4],[1.5,0.5,1.4]]]),MATNF)));
    const lit=mesh(geo('planeL',()=>merge([[SP,0xff3030,[10.8,-0.5,-2],[0.35,0.35,0.35]],[SP,0x30ff60,[-10.8,-0.5,-2],[0.35,0.35,0.35]]])),new THREE.MeshBasicMaterial({vertexColors:true,fog:false})); g.add(lit);
    const strobe=mesh(SP,new THREE.MeshBasicMaterial({color:0xffffff,fog:false})); strobe.scale.setScalar(0.45); strobe.position.set(0,-1.7,0); g.add(strobe); g.userData={strobe,h:1}; g.scale.setScalar(1.3); return g; }
  function kite(){ const g=new THREE.Group(), a=0x4a3a2c;
    g.add(mesh(geo('kite',()=>merge([[SP,a,[0,0,0],[0.25,0.2,0.75]],[SP,0x6b5640,[0,0.05,0.62],[0.15,0.15,0.17]],[BX,0x3a2c20,[0,0,-0.85],[0.55,0.05,0.5]],[BX,a,[-1.1,0.18,0.05],[2.0,0.06,0.62],[0,0,0.15]],[BX,a,[1.1,0.18,0.05],[2.0,0.06,0.62],[0,0,-0.15]],[BX,0x2a1f16,[-1.9,0.3,0.05],[0.5,0.07,0.5],[0,0,0.15]],[BX,0x2a1f16,[1.9,0.3,0.05],[0.5,0.07,0.5],[0,0,-0.15]]]))));
    g.scale.setScalar(1.5); g.userData={h:1}; return g; }

  // 遊隼：細隻、尖翼向後掃、灰藍背、淺色胸
  function falcon(){ const g=new THREE.Group(), b=0x4f5d6b;
    const body=mesh(geo('falc',()=>merge([[SP,b,[0,0,0],[0.17,0.15,0.55]],[SP,0xe9e1cf,[0,-0.05,0.12],[0.13,0.1,0.3]],[SP,0x2b3138,[0,0.04,0.5],[0.12,0.12,0.13]],[CN,0xe0a800,[0,0.02,0.64],[0.03,0.08,0.03],[Math.PI/2,0,0]],[BX,b,[0,0,-0.6],[0.22,0.04,0.42]]])));
    const wing=mesh(geo('falcW',()=>merge([[BX,b,[-0.62,0.03,-0.08],[1.15,0.04,0.34],[0,-0.42,0]],[BX,b,[0.62,0.03,-0.08],[1.15,0.04,0.34],[0,0.42,0]],[BX,0x2b3138,[-1.12,0.04,-0.32],[0.4,0.04,0.2],[0,-0.7,0]],[BX,0x2b3138,[1.12,0.04,-0.32],[0.4,0.04,0.2],[0,0.7,0]]])));
    g.add(body,wing); g.userData={wing}; g.scale.setScalar(2.4); return g; }
  /* ----- 池 ----- */
  const pools={}, live=[];
  const take=(key,mk)=>{ const p=pools[key]||(pools[key]=[]); const g=p.pop()||mk(); g.visible=true; if(!g.parent) scene.add(g); return g; };
  const free=a=>{ a.g.visible=false; (pools[a.key]||(pools[a.key]=[])).push(a.g); a.dead=true; };
  function clear(){ live.forEach(free); live.length=0; }
  const FS=new THREE.Sphere(new THREE.Vector3(),2), CD=new THREE.Vector3();
  function seen(x,y,z,r,far){ const dx=x-cam.position.x, dz=z-cam.position.z, dy=y-cam.position.y; if(dx*dx+dy*dy+dz*dz>far*far) return false; FS.center.set(x,y,z); FS.radius=r; return FR.intersectsSphere(FS); }
  const count=k=>live.reduce((n,a)=>n+(a.cls===k?1:0),0);
  const rnd2=(a,b)=>a+Math.random()*(b-a);

  /* ----- 行人路動物 ----- */
  function spawnGround(any){ cam.getWorldDirection(CD); const cx=cam.position.x, cz=cam.position.z;
    for(let tries=0;tries<60;tries++){ const r=MAP.roads[Math.random()*MAP.roads.length|0]; if(r.bridge||r.elev||r.closed) continue;
      const A=NODES[r.n[0]],B=NODES[r.n[1]], L=Math.hypot(B[0]-A[0],B[1]-A[1]); if(L<16) continue;
      const s=rnd2(5,L-5), ux=(B[0]-A[0])/L, uz=(B[1]-A[1])/L, side=Math.random()<0.5?1:-1, off=(r.w/2+1.3+Math.random()*1.2)*side;
      const x=A[0]+ux*s+uz*off, z=A[1]+uz*s-ux*off, dx=x-cx, dz=z-cz, d=Math.hypot(dx,dz);
      if(d<(any?20:80)||d>210||(!any&&(dx*CD.x+dz*CD.z)/d<0.35)) continue; if(cellAt(x,z)&1) continue;   // 前面遠少少、唔可以喺馬路上
      const rur=REGION==='tm'&&rural(x,z), W=(rur?[['cow',4],['dog',3],['sparrow',3]]:[['cat',30],['dog',22],['pigeon',33],['sparrow',15]]).filter(([k])=>CFG.types[k]);
      if(!W.length) continue; let q=Math.random()*W.reduce((n,w)=>n+w[1],0), kind=W[0][0]; for(const [k,w] of W){ if((q-=w)<0){ kind=k; break; } }
      let g, key;
      if(kind==='cat'){ const v=Math.random()*CATC.length|0; key='cat'+v; g=take(key,()=>cat(v)); }
      else if(kind==='dog'){ const v=Math.random()*DOGC.length|0; key='dog'+v; g=take(key,()=>dog(v)); }
      else if(kind==='cow'){ key='cow'; g=take(key,cow); }
      else { key=kind; g=take(key,()=>flock(kind,kind==='pigeon'?4:3)); g.userData.bs.forEach((b,i)=>{ b.position.set(rnd2(-1.2,1.2),0,rnd2(-1.2,1.2)); b.rotation.set(0,Math.random()*6.28,0); b.userData.wing.visible=false; b.userData.v=null; }); }
      const a={cls:'ground',kind,key,g,A,B,L,ux,uz,s,off,dir:Math.random()<0.5?1:-1,mode:kind==='pigeon'||kind==='sparrow'?'peck':'walk',mt:rnd2(2,6),life:0,seenT:false,gone:0,x,z,y:0,ph:Math.random()*6};
      g.position.set(x,0.15,z); g.scale.setScalar(0.01); live.push(a); return; } }
  function tickGround(a,dt,t){ const c=S.car, near=Math.hypot(a.x-c.x,a.z-c.z), fast=Math.abs(c.v)>1.5;
    const k=Math.min(1,a.life/0.6); a.g.scale.setScalar(Math.max(0.01,k)*(a.kind==='cow'?1.25:a.kind==='dog'?1.15:1.35));
    if(a.kind==='pigeon'||a.kind==='sparrow'){ const bs=a.g.userData.bs;
      if(a.mode==='peck'&&(near<(S.siren?22:13)&&fast||near<5)){ a.mode='fly'; const ax=a.x-c.x, az=a.z-c.z, n=Math.hypot(ax,az)||1; a.vx=ax/n*7; a.vz=az/n*7; bs.forEach(b=>{ b.userData.wing.visible=true; b.rotation.set(0,Math.atan2(a.vx,a.vz)+rnd2(-0.4,0.4),0); b.userData.v=rnd2(3,5); }); }
      if(a.mode==='peck'){ a.mt-=dt; bs.forEach((b,i)=>{ const hop=a.kind==='sparrow'?Math.max(0,Math.sin(t*7+i*2)): 0; b.position.y=hop*0.18; b.rotation.x=Math.max(0,Math.sin(t*(a.kind==='sparrow'?9:5)+i*1.7))*0.55;
          if(a.kind==='pigeon'){ b.position.x+=Math.sin(b.rotation.y)*0.25*dt; b.position.z+=Math.cos(b.rotation.y)*0.25*dt; if(Math.random()<dt*0.3) b.rotation.y+=rnd2(-1,1); } }); }
      else { a.x+=a.vx*dt; a.z+=a.vz*dt; bs.forEach((b,i)=>{ b.position.y+=b.userData.v*dt; b.rotation.x=-0.25; const w=b.userData.wing; w.scale.x=0.35+0.65*Math.abs(Math.sin(t*22+i)); }); a.y=bs[0].position.y; }
      a.g.position.set(a.x,0.15,a.z); return; }
    // 貓狗牛：沿行人路行，有時停低；救護車衝埋嚟就走開
    const U=a.g.userData; let sp=a.kind==='cat'?0.9:a.kind==='dog'?1.4:0.5;
    if(a.mode!=='flee'&&near<(S.siren?18:10)&&fast&&a.kind!=='cow'){ a.mode='flee'; a.mt=1.6; const ahead=(a.x-c.x)*a.ux+(a.z-c.z)*a.uz; a.dir=ahead>=0?1:-1; }
    a.mt-=dt;
    if(a.mode==='flee'){ sp=a.kind==='cat'?6:5; if(a.mt<0){ a.mode='walk'; a.mt=rnd2(3,7); } }
    else if(a.mode==='walk'&&a.mt<0){ a.mode='rest'; a.mt=rnd2(2,5); }
    else if(a.mode==='rest'&&a.mt<0){ a.mode='walk'; a.mt=rnd2(3,8); if(Math.random()<0.4) a.dir*=-1; }
    const moving=a.mode!=='rest';
    if(moving){ a.s+=a.dir*sp*dt; if(a.s<3||a.s>a.L-3){ a.dir*=-1; a.s=Math.max(3,Math.min(a.L-3,a.s)); } }
    a.x=a.A[0]+a.ux*a.s+a.uz*a.off; a.z=a.A[1]+a.uz*a.s-a.ux*a.off;
    const sw=moving?Math.sin(t*(sp>3?18:8)+a.ph)*(sp>3?0.8:0.5):0; U.lF.rotation.x=sw; U.lB.rotation.x=-sw;
    a.g.position.set(a.x,0.15,a.z); const ya=Math.atan2(a.ux*a.dir,a.uz*a.dir); a.g.rotation.y=a.mode==='rest'?ya+Math.sin(t*0.7+a.ph)*0.5:ya; }

  /* ----- 鴨仔：沿城門河／屯門河／湖慢慢游 ----- */
  const RC=[0]; for(let i=1;i<RIV.length;i++) RC.push(RC[i-1]+Math.hypot(RIV[i][0]-RIV[i-1][0],RIV[i][1]-RIV[i-1][1])); const RLEN=RC[RC.length-1];
  function rivAt(s){ s=Math.max(0,Math.min(RLEN,s)); let i=1; while(i<RC.length-1&&RC[i]<s) i++; const A=RIV[i-1],B=RIV[i], L=RC[i]-RC[i-1]||1, f=(s-RC[i-1])/L; return [A[0]+(B[0]-A[0])*f,A[1]+(B[1]-A[1])*f,(B[0]-A[0])/L,(B[1]-A[1])/L]; }
  const LC=(()=>{ let x=0,z=0; LAKE.forEach(p=>{x+=p[0];z+=p[1];}); x/=LAKE.length; z/=LAKE.length; let r=1e9; LAKE.forEach(p=>r=Math.min(r,Math.hypot(p[0]-x,p[1]-z))); return [x,z,r]; })();
  function spawnDucks(any){ const cx=cam.position.x, cz=cam.position.z; cam.getWorldDirection(CD);
    const okd=(x,z)=>{ const dx=x-cx, dz=z-cz, d=Math.hypot(dx,dz); return d>(any?20:60)&&d<(any?2000:230)&&(any||(dx*CD.x+dz*CD.z)/d>0.2); };
    if(LC[2]>6&&okd(LC[0],LC[1])&&Math.random()<0.5){ const g=take('ducks',family); live.push({cls:'duck',key:'ducks',g,lake:true,ang:Math.random()*6.28,rad:LC[2]*0.55,dir:Math.random()<0.5?1:-1,life:0,seenT:false,gone:0}); return; }
    for(let tries=0;tries<40;tries++){ const s=Math.random()*RLEN, P=rivAt(s), lat=rnd2(-1,1)*(RIVH-RIVH*0.45-1.5); const x=P[0]+P[3]*lat, z=P[1]-P[2]*lat; if(!okd(x,z)) continue;
      const g=take('ducks',family); live.push({cls:'duck',key:'ducks',g,s,lat,dir:Math.random()<0.5?1:-1,life:0,seenT:false,gone:0}); return; } }
  function tickDuck(a,dt,t){ const g=a.g; let x,z,ya;
    if(a.lake){ a.ang+=a.dir*dt*0.9/a.rad; x=LC[0]+Math.cos(a.ang)*a.rad; z=LC[1]+Math.sin(a.ang)*a.rad; ya=Math.atan2(-Math.sin(a.ang)*a.dir,Math.cos(a.ang)*a.dir); }
    else { a.s+=a.dir*0.9*dt; if(a.s<5||a.s>RLEN-5) a.dir*=-1; const P=rivAt(a.s); x=P[0]+P[3]*a.lat; z=P[1]-P[2]*a.lat; ya=Math.atan2(P[2]*a.dir,P[3]*a.dir); }
    a.x=x; a.z=z; a.y=0; g.position.set(x,0.22,z); g.rotation.y=ya; g.scale.setScalar(Math.max(0.01,Math.min(1,a.life/0.8))*1.3);
    g.userData.ds.forEach((d,i)=>{ d.position.y=Math.sin(t*3+i)*0.04; d.rotation.y=Math.sin(t*1.3+i*0.8)*0.25; }); }

  /* ----- 飛機同麻鷹 ----- */
  // 鏡頭前方（水平）方向
  // 鏡頭畫面某個高度（NDC y）喺前方 d 米水平距離嘅世界高度：保證生成時喺畫面入面
  const _u=new THREE.Vector3(); function skyY(d,ny){ _u.set(0,ny,0.5).unproject(cam).sub(cam.position).normalize(); const h=Math.hypot(_u.x,_u.z)||1e-3; return cam.position.y+_u.y*d/h; }
  const halfW=d=>Math.tan(THREE.MathUtils.degToRad(cam.fov/2))*cam.aspect*d;
  const fwd=()=>{ cam.getWorldDirection(CD); const l=Math.hypot(CD.x,CD.z)||1; return [CD.x/l,CD.z/l]; };
  function spawnPlane(hw){ const g=take('plane',plane);
    if(hw){ // 高速公路：喺前方 200–260 米橫過，3 秒內入鏡
      const [fx,fz]=fwd(), d=rnd2(200,260), sd=Math.random()<0.5?1:-1, th=Math.atan2(fz,fx)+sd*(Math.PI/2+rnd2(-0.5,0.3)), ux=Math.cos(th), uz=Math.sin(th);
      live.push({cls:'plane',key:'plane',g,cx:cam.position.x+fx*d,cz:cam.position.z+fz*d,ux,uz,s:-(halfW(d)+25),y:Math.max(cam.position.y+10,skyY(d,rnd2(0.45,0.7))),life:0,seenT:false,gone:0,hw:true}); return; }
    const th=Math.random()*6.28, ux=Math.cos(th), uz=Math.sin(th), o=rnd2(-160,160);
    const cx=cam.position.x-uz*o, cz=cam.position.z+ux*o; live.push({cls:'plane',key:'plane',g,cx,cz,ux,uz,s:-650,y:rnd2(150,210),life:0,seenT:false,gone:0}); }
  function tickPlane(a,dt,t){ a.s+=72*dt; a.x=a.cx+a.ux*a.s; a.z=a.cz+a.uz*a.s; a.y+=dt*1.5; a.g.position.set(a.x,a.y,a.z); a.g.rotation.set(-0.04,Math.atan2(a.ux,a.uz),0);
    a.g.userData.strobe.visible=(t*1.2%1)<0.08; }
  function spawnKite(hw){ const [fx,fz]=fwd(), d=hw?rnd2(55,80):rnd2(60,130); const cx=cam.position.x+fx*d, cz=cam.position.z+fz*d;
    live.push({cls:'kite',key:'kite',g:take('kite',kite),cx,cz,R:hw?rnd2(16,24):rnd2(22,40),ang:Math.random()*6.28,dir:Math.random()<0.5?1:-1,y:hw?Math.max(cam.position.y+6,skyY(d,rnd2(0.35,0.55))):rnd2(42,62),T:rnd2(hw?14:25,hw?22:40),life:0,seenT:false,gone:0,hw:!!hw}); }
  // 遊隼：滑翔 → 俯衝 → 拉返上去飛走
  function spawnFalcon(hw){ const [fx,fz]=fwd(), d=hw?rnd2(70,95):rnd2(80,140), sd=Math.random()<0.5?1:-1, px=-fz*sd, pz=fx*sd, lw=hw?halfW(d)*0.8:45;
    live.push({cls:'falcon',key:'falcon',g:take('falcon',falcon),x:cam.position.x+fx*d-px*lw,z:cam.position.z+fz*d-pz*lw,y:hw?Math.max(cam.position.y+8,skyY(d,rnd2(0.4,0.55))):cam.position.y+rnd2(40,55),hx:px*0.9-fx*0.3,hz:pz*0.9-fz*0.3,ph:'glide',pt:rnd2(1.8,2.6),life:0,seenT:false,gone:0,hw:!!hw}); }
  function tickFalcon(a,dt,t){ const W=a.g.userData.wing; a.pt-=dt; let v=20, vy=0, pitch=0;
    if(a.ph==='glide'){ W.scale.x=1; if(a.pt<0){ a.ph='dive'; a.pt=1.3; } }
    else if(a.ph==='dive'){ v=34; vy=-20; pitch=0.7; W.scale.x=0.45; if(a.pt<0||a.y<cam.position.y-6){ a.ph='climb'; a.pt=9; } }
    else { v=24; vy=9; pitch=-0.35; W.scale.x=0.7+0.3*Math.abs(Math.sin(t*14)); }
    const l=Math.hypot(a.hx,a.hz)||1; a.x+=a.hx/l*v*dt; a.z+=a.hz/l*v*dt; a.y=Math.max(4,a.y+vy*dt);
    a.g.position.set(a.x,a.y,a.z); a.g.rotation.set(pitch,Math.atan2(a.hx,a.hz),0); }
  function tickKite(a,dt,t){ const w=a.dir*0.32; if(a.life<a.T){ a.ang+=w*dt; a.x=a.cx+Math.cos(a.ang)*a.R; a.z=a.cz+Math.sin(a.ang)*a.R; a.hx=-Math.sin(a.ang)*a.dir; a.hz=Math.cos(a.ang)*a.dir; a.roll=a.dir*0.35; }
    else { a.x+=a.hx*11*dt; a.z+=a.hz*11*dt; a.y+=dt*2; a.roll*=0.98; }
    a.g.position.set(a.x,a.y,a.z); a.g.rotation.set(0,Math.atan2(a.hx,a.hz),0); a.g.rotateZ(-a.roll); const fl=(t%9)<1.2?Math.abs(Math.sin(t*10)):0; a.g.scale.set(1.5*(1-fl*0.25),1.5,1.5); }

  /* ----- 每格 ----- */
  const T={g:2,d:3,p:rnd2(12,30),k:rnd2(8,20),hc:0}, HW={on:false,wait:2};
  const HWN=REGION==='tm'?['元朗公路','天水圍路']:['沙田路','大埔公路'];
  function onHighway(){ const c=S.car; if(REGION==='tm'&&ELEV(c.x,c.z)>3) return true;
    for(const r of MAP.roads){ if(!HWN.includes(r.name)) continue; const A=NODES[r.n[0]],B=NODES[r.n[1]], dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; let k=((c.x-A[0])*dx+(c.z-A[1])*dz)/L2; k=Math.max(0,Math.min(1,k));
      const qx=A[0]+dx*k-c.x, qz=A[1]+dz*k-c.z; if(qx*qx+qz*qz<(r.w/2+2)**2) return REGION!=='tm'||ELEV(c.x,c.z)>1||!r.elev; } return false; }
  function tick(dt,t){
    if(S.mode==='menu'||S.mode==='cpr'||!CFG.on){ if(live.length) clear(); return; }
    if(S.mode!=='drive') return;
    const night=!!(TOD[S.level&&S.level.tod]||{}).night, rain=!!S.wet, NG=rain?Math.ceil(CFG.ground/2):CFG.ground;
    if((T.g-=dt)<0){ T.g=rnd2(2.5,5)*4/Math.max(4,CFG.ground); if(count('ground')<NG) spawnGround(); }
    if((T.d-=dt)<0){ T.d=rnd2(4,8)*2/Math.max(2,CFG.ducks); if(!night&&count('duck')<CFG.ducks) spawnDucks(); }
    if((T.p-=dt)<0){ T.p=rnd2(45,90); if(CFG.plane&&!count('plane')) spawnPlane(); }
    if((T.k-=dt)<0){ T.k=rnd2(30,60); if(CFG.kite&&!night&&!rain&&!count('kite')) Math.random()<0.7?spawnKite():(!count('falcon')&&spawnFalcon()); }
    // 高速公路：駛上去 3 秒內一定有飛機或者猛禽喺前面天空飛過；之後每 15–25 秒再嚟
    if((T.hc-=dt)<0){ T.hc=0.4; HW.on=onHighway(); if(!HW.on) HW.wait=rnd2(1.2,3); }
    if(HW.on){ const sky=live.some(a=>!a.dead&&(a.cls==='plane'||a.cls==='kite'||a.cls==='falcon')&&(a.hw||a.seenT));
      if(!sky&&(HW.wait-=dt)<0){ const day=!night&&!rain&&CFG.kite, q=Math.random();
        if(!CFG.plane&&!day){ HW.wait=5; } else { if(CFG.plane&&(!day||q<0.5)){ live.filter(a=>a.cls==='plane').forEach(free); spawnPlane(true); } else if(q<0.75) spawnKite(true); else spawnFalcon(true); HW.wait=rnd2(15,25); } } }
    const far=Math.min(cam.far,scene.fog.far+40);
    for(const a of live){ a.life+=dt;
      if(a.cls==='ground') tickGround(a,dt,t); else if(a.cls==='duck') tickDuck(a,dt,t); else if(a.cls==='plane') tickPlane(a,dt,t); else if(a.cls==='falcon') tickFalcon(a,dt,t); else tickKite(a,dt,t);
      const isP=a.cls==='plane'||a.cls==='kite'||a.cls==='falcon', v=seen(a.x,(a.y||0)+1,a.z,a.cls==='plane'?16:isP?4:3,isP?cam.far:far);
      if(v){ a.seenT=true; a.gone=0; } else if(a.seenT) a.gone+=dt;
      const dc=Math.hypot(a.x-cam.position.x,a.z-cam.position.z);
      if(a.gone>0.8||(!a.seenT&&a.life>(a.cls==='plane'?25:30))||(a.cls!=='plane'&&dc>360)||(a.cls==='plane'&&a.s>700)) free(a); }
    for(let i=live.length-1;i>=0;i--) if(live[i].dead) live.splice(i,1); }
  // 設定：改完即時生效（關閉或者某類動物唔要就即刻收返）
  function setCfg(c){ CFG=c; store.set('ani',c); for(const a of live){ if(!c.on||(a.cls==='ground'&&!c.types[a.kind])||(a.cls==='plane'&&!c.plane)||((a.cls==='kite'||a.cls==='falcon')&&!c.kite)) free(a); }
    let g=live.filter(a=>!a.dead&&a.cls==='ground'), d=live.filter(a=>!a.dead&&a.cls==='duck'); g.slice(c.ground).forEach(free); d.slice(c.ducks).forEach(free);
    for(let i=live.length-1;i>=0;i--) if(live[i].dead) live.splice(i,1); }
  return {tick,clear,live,cfg:()=>JSON.parse(JSON.stringify(CFG)),setCfg,def:ANI_DEF,sp:{g:spawnGround,d:spawnDucks,p:spawnPlane,k:spawnKite,f:spawnFalcon},hw:()=>HW.on};
})();
window.__ANI=ANI;
/* ---------- 畫面質素自動檢查：揸車頭 8 秒平均每秒少過 25 格，就問要唔要降一級（每部機只問一次） ---------- */
const GFXW={t:0,n:0,done:store.get('gfxAsked',false)||!GFX};
function gfxWatch(dt){ if(GFXW.done) return; const now=performance.now(); if(S.mode!=='drive'||document.hidden){ GFXW.t0=0; GFXW.n=0; return; } if(!GFXW.t0){ GFXW.t0=now; GFXW.n=0; return; } GFXW.n++; if(now-GFXW.t0<8000) return; GFXW.done=true;
  const fps=GFXW.n/((now-GFXW.t0)/1000); if(fps>=25) return; if(!DRES.atMin){ GFXW.done=false; GFXW.t0=0; return; } store.set('gfxAsked',true);   // 自動解像度降到最低都仲慢先問
  const lv=GFX>=2?1:0, nm=lv?'精細':'標準', box=document.createElement('div'); box.className='gfxAsk';
  box.innerHTML='<div class="card"><b>🖼️ 部機有啲吃力</b><p>而家大約每秒 '+Math.round(fps)+' 格。轉做「'+nm+'」會順好多（要重新載入地圖）。</p><div class="gfxBtns"><button class="sec">唔使</button><button class="pri">轉做'+nm+'</button></div></div>';
  document.body.append(box); const [no,yes]=box.querySelectorAll('button'); no.onclick=()=>box.remove(); yes.onclick=()=>{ store.set('gfx',lv); location.reload(); }; }

/* ---------- 🎉 歡樂模式（隱藏）：長按選單左上角 A188 五秒解鎖 ----------
   只喺歡樂模式生效：全車性能解放、上行人路唔減速、撞人噴紅色液體同血泊、撞車爆炸彈飛、
   🚀 氮氣加速、連環撞分數、慢鏡、七彩警號燈、彩紙、唔會扣心／唔會 Game Over（亦唔計正式成績同成就） */
/* ----- 長按解鎖 ----- */
{ const b=document.querySelector('#menu .badge'); let tm=null, t0=0, raf=0;
  const ring=()=>{ const p=Math.min(1,(performance.now()-t0)/5000); b.style.background='conic-gradient(#ff2d95 '+(p*360)+'deg, var(--red, #e23b3b) 0)'; b.style.transform='scale('+(1+p*0.25)+')'; if(p<1) raf=requestAnimationFrame(ring); };
  const stop=()=>{ clearTimeout(tm); tm=null; cancelAnimationFrame(raf); b.style.background=''; b.style.transform=''; };
  const done=()=>{ stop(); const first=!FUN.unlocked; FUN.unlocked=true; FUN.on=true; store.set('funU',1); store.set('funOn',1); vib(200);
      toast(first?'🎉 歡樂模式已解鎖！喺「設定」可以開關':'🎉 歡樂模式：開'); renderMenu('set'); try{ funBurst(); }catch(e){} };
  b.addEventListener('pointerdown',e=>{ t0=performance.now(); raf=requestAnimationFrame(ring); tm=setTimeout(done,5000); });
  b.addEventListener('pointerup',()=>{ if(tm&&performance.now()-t0>=5000) done(); else stop(); });   // 部機忙嘅時候計時器會遲，放手時再計一次
  ['pointerleave','pointercancel'].forEach(k=>b.addEventListener(k,stop));
  b.addEventListener('contextmenu',e=>e.preventDefault()); }
function funSet(v){ FUN.on=!!v&&FUN.unlocked; store.set('funOn',FUN.on?1:0); funHud(); }

/* ----- 共用貼圖 ----- */
const FXT={
  glow:canvasTex(64,64,(g,w,h)=>{ const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2); r.addColorStop(0,'rgba(255,255,220,1)'); r.addColorStop(0.3,'rgba(255,190,60,.95)'); r.addColorStop(0.7,'rgba(255,80,0,.5)'); r.addColorStop(1,'rgba(120,20,0,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); },false),
  smoke:canvasTex(64,64,(g,w,h)=>{ const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2); r.addColorStop(0,'rgba(70,70,70,.85)'); r.addColorStop(0.6,'rgba(50,50,50,.5)'); r.addColorStop(1,'rgba(40,40,40,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); },false),
  pool:canvasTex(128,128,(g,w,h)=>{ g.beginPath(); for(let i=0;i<=28;i++){ const a=i/28*Math.PI*2, r=w*0.42*(0.86+0.14*Math.sin(i*2.7)+0.06*Math.cos(i*5.3)); g.lineTo(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r); } g.closePath();
    const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w*0.45); r.addColorStop(0,'#5c0000'); r.addColorStop(0.75,'#8c0000'); r.addColorStop(1,'#a30a0a'); g.fillStyle=r; g.fill(); g.fillStyle='rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(w*0.4,h*0.38,w*0.1,h*0.05,-0.5,0,6.3); g.fill(); },false) };
/* ----- 粒子：紅色液體、碎片、彩紙（InstancedMesh，三個繪製） ----- */
function partSys(n,geo,mat,colored){ const im=new THREE.InstancedMesh(geo,mat,n); im.frustumCulled=false; im.count=0; scene.add(im);
  const P=[]; for(let i=0;i<n;i++) P.push({life:0}); if(colored) im.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(n*3),3);
  const o=new THREE.Object3D(), col=new THREE.Color(); let next=0;
  return { emit(x,y,z,vx,vy,vz,life,s,hex,spin){ const p=P[next]; next=(next+1)%n; Object.assign(p,{x,y,z,vx,vy,vz,life,max:life,s,stuck:false,rx:Math.random()*6,ry:Math.random()*6,spin:spin||0}); if(colored){ col.setHex(hex); im.setColorAt(P.indexOf(p),col); im.instanceColor.needsUpdate=true; } },
    tick(dt,ground){ let k=0; for(let i=0;i<n;i++){ const p=P[i]; if(p.life<=0) continue; p.life-=dt;
        if(!p.stuck){ p.vy-=(ground==='paper'?3:22)*dt; if(ground==='paper'){ p.vx*=0.98; p.vz*=0.98; p.vy=Math.max(p.vy,-2.5); } p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.rx+=p.spin*dt; p.ry+=p.spin*0.7*dt;
          if(p.y<0.16){ p.y=0.16; if(ground==='splat'){ p.stuck=true; p.vx=p.vz=p.vy=0; } else { p.vy=-p.vy*0.3; p.vx*=0.6; p.vz*=0.6; p.spin*=0.5; } } }
        const fade=Math.min(1,p.life/0.5); o.position.set(p.x,p.y,p.z);
        if(p.stuck){ o.rotation.set(0,p.ry,0); o.scale.set(p.s*2.2*fade,0.05,p.s*2.2*fade); } else { o.rotation.set(p.rx,p.ry,0); o.scale.setScalar(p.s*fade); }
        o.updateMatrix(); im.setMatrixAt(i,o.matrix); k=i+1; }
      for(let i=0;i<k;i++) if(P[i].life<=0){ o.scale.setScalar(0); o.updateMatrix(); im.setMatrixAt(i,o.matrix); }
      im.count=k; im.instanceMatrix.needsUpdate=true; } }; }
const BLOOD=partSys(260,new THREE.SphereGeometry(1,6,4),new THREE.MeshLambertMaterial({color:0xa00000}),false);
const DEBRIS=partSys(140,new THREE.BoxGeometry(1,0.5,1),new THREE.MeshLambertMaterial({color:0xffffff}),true);
const PAPER=partSys(320,new THREE.PlaneGeometry(1,0.6),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}),true);
/* ----- 火球、煙（Sprite 池，每個自己材質方便淡出） ----- */
const SPR=[]; function sprite(map,add){ let s=SPR.find(q=>!q.visible&&q.userData.add===add); if(!s){ s=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending})); s.userData.add=add; scene.add(s); SPR.push(s); } s.visible=true; return s; }
const FLASH=new THREE.PointLight(0xffa040,0,60,2); scene.add(FLASH);
function explode(x,y,z,power){ const P=Math.min(2.2,0.6+power/20);
  for(let i=0;i<7;i++){ const s=sprite(FXT.glow,true); s.position.set(x+(Math.random()-0.5)*2*P,y+1+Math.random()*1.5*P,z+(Math.random()-0.5)*2*P); s.userData.t=0; s.userData.max=0.55+Math.random()*0.4; s.userData.sz=(3+Math.random()*3)*P; s.userData.vy=1.5; s.material.opacity=1; s.scale.setScalar(0.5); }
  for(let i=0;i<8;i++){ const s=sprite(FXT.smoke,false); s.position.set(x+(Math.random()-0.5)*3,y+1.5,z+(Math.random()-0.5)*3); s.userData.t=-Math.random()*0.3; s.userData.max=2.2+Math.random(); s.userData.sz=(4+Math.random()*4)*P; s.userData.vy=2.2+Math.random()*1.5; s.material.opacity=0; s.scale.setScalar(1); }
  for(let i=0;i<Math.round(16*P);i++){ const a=Math.random()*6.28, v=6+Math.random()*10*P; DEBRIS.emit(x,y+1.2,z,Math.cos(a)*v,5+Math.random()*9*P,Math.sin(a)*v,2.4,0.25+Math.random()*0.35,[0x333333,0x777777,0xff7a00,0xffd000,0x222222][i%5],8+Math.random()*10); }
  FLASH.position.set(x,y+3,z); FLASH.intensity=6*P; S.shake=Math.max(S.shake||0,0.5+0.3*P); vib(120); funBoom(P); }
function bleed(x,z,dirx,dirz,sp){ const n=18+Math.min(30,sp*1.5|0);
  for(let i=0;i<n;i++){ const a=Math.atan2(dirx,dirz)+(Math.random()-0.5)*1.6, v=2+Math.random()*(3+sp*0.25); BLOOD.emit(x,1.3+Math.random()*0.5,z,Math.sin(a)*v,3+Math.random()*5,Math.cos(a)*v,4+Math.random()*3,0.07+Math.random()*0.09); } }
// 血泊：倒地之後由細變大
const POOLS=[]; function bloodPool(x,z,base){ let m=POOLS.find(q=>!q.visible); if(!m){ if(POOLS.length>=14){ m=POOLS.sort((a,b)=>a.userData.t0-b.userData.t0)[0]; } else { m=new THREE.Mesh(new THREE.CircleGeometry(1,24),new THREE.MeshLambertMaterial({map:FXT.pool,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3})); m.rotation.x=-Math.PI/2; m.renderOrder=1; scene.add(m); POOLS.push(m); } }
  m.visible=true; m.position.set(x,(base||0)+0.17,z); m.rotation.z=Math.random()*6.28; m.userData={t0:performance.now(),age:0,R:1.5+Math.random()*0.7}; m.scale.setScalar(0.05); m.material.opacity=1; }

/* ----- 撞人／撞車 ----- */
function funHitPed(p,c){ const sp=Math.abs(c.v); bleed(p.pos[0],p.pos[1],Math.sin(c.a),Math.cos(c.a),sp); p.funPool=true; pedFly(p,c); c.v/=0.85; funScore(100,'💥 撞飛路人'); }
function funHitCar(k,c){ const sp=Math.abs(c.v); if(k.fly||sp<3) return false; const pos=k.pose; explode(pos.x,ELEV(pos.x,pos.z),pos.z,sp);
  const a=Math.atan2(pos.x-c.x,pos.z-c.z); k.fly={x:pos.x,y:ELEV(pos.x,pos.z),z:pos.z,vx:Math.sin(a)*sp*0.45+Math.sin(c.a)*sp*0.55,vz:Math.cos(a)*sp*0.45+Math.cos(c.a)*sp*0.55,vy:6+sp*0.45,rx:(Math.random()-0.5)*6,ry:(Math.random()-0.5)*5,rz:(Math.random()-0.5)*8,t:0,smoke:0};
  k.pose=null; c.v*=0.9; if(sp>18){ FUN.slow=0.7; } funScore(Math.round(200+sp*15),sp>18?'🔥 爆炸飛車！':'💥 撞爆車'); return true; }
function funCarTick(k,dt){ const f=k.fly; f.t+=dt; const m=k.m;
  if(f.y>0||f.vy>0){ f.vy-=20*dt; f.x+=f.vx*dt; f.z+=f.vz*dt; f.y=Math.max(0,f.y+f.vy*dt); m.rotation.x+=f.rx*dt; m.rotation.y+=f.ry*dt; m.rotation.z+=f.rz*dt;
    if(f.y===0&&f.vy<0){ f.vy=f.vy<-5?-f.vy*0.3:0; f.vx*=0.5; f.vz*=0.5; f.rx*=0.4; f.rz*=0.4; if(Math.abs(f.vy)<1){ m.rotation.x=Math.round(m.rotation.x/Math.PI)*Math.PI; m.rotation.z=Math.round(m.rotation.z/Math.PI)*Math.PI; } } }
  m.position.set(f.x,f.y+0.1,f.z); f.smoke-=dt; if(f.smoke<0&&f.t<7){ f.smoke=0.25; const s=sprite(FXT.smoke,false); s.position.set(f.x,f.y+1.5,f.z); s.userData.t=0; s.userData.max=1.8; s.userData.sz=3; s.userData.vy=2.5; s.material.opacity=0; }
  if(f.t>6&&!inView(f.x,f.z,6)){ m.rotation.set(0,0,0); k.fly=null; if(!placeCar(k,S.car.x,S.car.z)){ k.fly=f; f.t=5; } } }

/* ----- 分數、連環、慢鏡、七彩 ----- */
const funEl=document.createElement('div'); funEl.id='funTxt'; document.body.append(funEl);
const funHudEl=document.createElement('div'); funHudEl.id='funHud'; document.body.append(funHudEl);
function funHud(){ funHudEl.style.display=FUN.on&&S.mode==='drive'?'block':'none'; funHudEl.textContent='🎉 '+FUN.score.toLocaleString(); const n=$('bN'); if(n) n.style.display=FUN.on?'':'none'; }
function funScore(pts,label){ FUN.combo=FUN.comboT>0?FUN.combo+1:1; FUN.comboT=3; const mul=Math.min(10,FUN.combo); FUN.score+=pts*mul; funHud();
  funEl.innerHTML=label+(FUN.combo>1?'<br><b>COMBO ×'+FUN.combo+'</b>':'')+'<small>+'+(pts*mul)+'</small>'; funEl.classList.remove('pop'); void funEl.offsetWidth; funEl.classList.add('pop');
  if(FUN.combo>=5&&FUN.combo%5===0) funBurst(); }
function funBurst(){ const c=cam.position; const fw=new THREE.Vector3(); cam.getWorldDirection(fw);
  for(let i=0;i<120;i++){ PAPER.emit(c.x+fw.x*14+(Math.random()-0.5)*16,c.y+4+Math.random()*6,c.z+fw.z*14+(Math.random()-0.5)*16,(Math.random()-0.5)*6,Math.random()*4,(Math.random()-0.5)*6,4+Math.random()*2,0.35+Math.random()*0.25,[0xff2d95,0xffd400,0x2bd4ff,0x7cff4f,0xff7a00,0xb26bff][i%6],6+Math.random()*8); } }
let funAC=null; function funBoom(P){ try{ funAC=funAC||new (window.AudioContext||window.webkitAudioContext)(); const a=funAC, n=a.createBufferSource(), len=a.sampleRate*0.9, b=a.createBuffer(1,len,a.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.2); n.buffer=b; const f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=700; const g=a.createGain(); g.gain.value=Math.min(1,0.35*P); n.connect(f).connect(g).connect(a.destination); n.start(); }catch(e){} }
// 每格：dt 經過呢度做慢鏡
function funTime(dt){ if(!FUN.on) return dt; if(FUN.slow>0){ FUN.slow-=dt; return dt*0.35; } return dt; }
function funTick(dt,t){ BLOOD.tick(dt,'splat'); DEBRIS.tick(dt,'bounce'); PAPER.tick(dt,'paper');
  SPR.forEach(s=>{ if(!s.visible) return; const u=s.userData; u.t+=dt; if(u.t<0) return; const k=u.t/u.max; if(k>=1){ s.visible=false; return; }
    s.position.y+=u.vy*dt; s.scale.setScalar(u.add?u.sz*(0.3+k*0.9):u.sz*(0.4+k)); s.material.opacity=u.add?(1-k):Math.min(0.75,k*4)*(1-k); });
  FLASH.intensity=Math.max(0,FLASH.intensity-dt*18);
  POOLS.forEach(m=>{ if(!m.visible) return; const u=m.userData; u.age+=dt; m.scale.setScalar(Math.max(0.05,u.R*Math.min(1,u.age/2.2))*(1-Math.max(0,u.age-40)/10)); if(u.age>50) m.visible=false; });
  if(FUN.comboT>0){ FUN.comboT-=dt; if(FUN.comboT<=0) FUN.combo=0; }
  // 氮氣火焰
  if(FUN.on&&S.hold.N&&S.mode==='drive'&&S.car.v>5){ const c=S.car; for(let k=0;k<2;k++){ const s=sprite(FXT.glow,true); s.position.set(c.x-Math.sin(c.a)*(3.6*VSPEC.kl)+(Math.random()-0.5)*0.6,ELEV(c.x,c.z)+0.7,c.z-Math.cos(c.a)*(3.6*VSPEC.kl)+(Math.random()-0.5)*0.6); s.userData.t=0; s.userData.max=0.25; s.userData.sz=1.6; s.userData.vy=0; s.material.opacity=1; } }
  if((FUN.hudT=(FUN.hudT||0)-dt)<0){ FUN.hudT=0.5; funHud(); } }
// 彈出字樣
{ const st=document.createElement('style'); st.textContent=`#funTxt{position:fixed;left:50%;top:32%;transform:translate(-50%,-50%) scale(0);pointer-events:none;z-index:40;text-align:center;font-weight:900;font-size:26px;color:#fff;text-shadow:0 0 8px #ff2d95,0 0 18px #ff2d95,2px 2px 0 #000;opacity:0;white-space:nowrap}
#funTxt b{font-size:34px;color:#ffe600;text-shadow:0 0 10px #ff7a00,2px 2px 0 #000}#funTxt small{display:block;font-size:16px;color:#7cff4f}
#funTxt.pop{animation:funPop 1.3s ease-out forwards}@keyframes funPop{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}15%{transform:translate(-50%,-50%) scale(1.25);opacity:1}30%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{transform:translate(-50%,-80%) scale(1);opacity:0}}
#funHud{position:fixed;left:50%;top:calc(118px + env(safe-area-inset-top));transform:translateX(-50%);display:none;z-index:30;background:linear-gradient(90deg,#ff2d95,#ff7a00,#ffd400);color:#fff;font-weight:900;font-size:15px;padding:4px 14px;border-radius:99px;text-shadow:1px 1px 0 #0006;pointer-events:none}
.btn.nitro{background:linear-gradient(#ff7a00,#ff2d95);color:#fff;font-size:20px}`; document.head.append(st); }
// 🚀 氮氣掣（Shift 鍵都得）
{ const col=document.querySelector('.btns .right .col'); if(col){ const b=document.createElement('button'); b.className='btn small nitro'; b.id='bN'; b.setAttribute('aria-label','氮氣加速'); b.textContent='🚀'; b.style.display=FUN.on?'':'none'; col.prepend(b); bindHold('bN','N'); } }
addEventListener('keydown',e=>{ if(e.key==='Shift') S.hold.N=true; }); addEventListener('keyup',e=>{ if(e.key==='Shift') S.hold.N=false; });
window.__FUN=FUN;
window.__funHitCar=funHitCar; window.__funHitPed=funHitPed;

/* ---------- 🎬 寫實模式：黃昏光影＋光暈（bloom）＋電影調色、低鏡頭、GTA 式介面（派遣接 Call、圓形小地圖、狀態條、錢、時間） ----------
   只係救護任務嘅另一種玩法外觀；關卡、路線同計分照用救護任務。 */
TOD.real={sky:0x2c2f52,hemi:[0xb4a6d6,0x3b3046,0.5],sun:[0xff9a5a,0.55],fog:[110,430],cloud:0x7a6f9a,night:true};
const REAL={on:false,comp:null,stress:0,cash:store.get('realCash',0),clock:0,dispatch:false};
// 天空：由地平線橙粉色漸變到頂部深藍（只喺寫實模式）
const realSky=(()=>{ const g=new THREE.SphereGeometry(400,32,16), col=[], P=g.attributes.position, c=new THREE.Color();
  const H=new THREE.Color(0xff9a6a), M=new THREE.Color(0x8a6aa8), T=new THREE.Color(0x1a2048);
  for(let i=0;i<P.count;i++){ const y=P.getY(i)/400; if(y<0.04) c.copy(H).lerp(M,Math.max(0,y)/0.04); else if(y<0.3) c.copy(M).lerp(T,(y-0.04)/0.26); else c.copy(T); if(y<0) c.copy(H).multiplyScalar(0.6); col.push(c.r,c.g,c.b); }
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false})); m.renderOrder=-10; m.visible=false; m.frustumCulled=false; scene.add(m); return m; })();
// 調色：邊位少少色散、對比、暗位偏藍／亮位偏橙、飽和度、暗角、菲林顆粒
const GRADE={uniforms:{tDiffuse:{value:null},time:{value:0}},
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
    void main(){ vec2 d=vUv-0.5; float r=dot(d,d); float ca=0.0025*r;
      vec3 col=vec3(texture2D(tDiffuse,vUv+d*ca).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-d*ca).b);
      col*=1.03; col=(col-0.5)*1.05+0.5;
      float l=dot(col,vec3(0.299,0.587,0.114));
      col=mix(col,col*vec3(0.9,0.95,1.1),(1.0-l)*0.22); col=mix(col,col*vec3(1.08,1.0,0.9),l*0.15);
      col=mix(vec3(l),col,1.06);
      col*=1.0-smoothstep(0.2,0.7,r*1.5)*0.28;
      float n=fract(sin(dot(vUv*vec2(12.9898,78.233)+time,vec2(1.0)))*43758.5453); col+=(n-0.5)*0.012;
      gl_FragColor=vec4(clamp(col,0.0,1.0),1.0); }`};
function realComposer(){ if(REAL.comp) return REAL.comp; const w=innerWidth, h=innerHeight;
  const C=new THREE.EffectComposer(R); C.addPass(new THREE.RenderPass(scene,cam));
  const bloom=new THREE.UnrealBloomPass(new THREE.Vector2(w/2,h/2),0.42,0.4,0.9); C.addPass(bloom);
  const gp=new THREE.ShaderPass(GRADE); C.addPass(gp); REAL.gp=gp; REAL.bloom=bloom;
  addEventListener('resize',()=>{ C.setSize(innerWidth,innerHeight); bloom.setSize(innerWidth/2,innerHeight/2); }); return REAL.comp=C; }
function realRender(t){ if(!REAL.fx){ R.render(scene,cam); return; } REAL.gp.uniforms.time.value=t%10; realSky.position.copy(cam.position); REAL.comp.render(); }

/* ----- 介面 ----- */
const RH=(()=>{ const d=document.createElement('div'); d.id='rHud'; d.innerHTML=`
  <div id="rMis"><div class="mt"><div class="ic">🚑</div><div><small id="rmS">緊急輔助醫療救護服務</small><b id="rmT">--</b><span id="rmP">--</span><span class="row">距離 <b id="rmD">--</b> · <span id="rmLl">限時</span> <b id="rmL">--</b></span></div></div>
    <div id="rBars"><div class="rb"><i>❤️</i><span>病人狀況</span><em id="rb1t">穩定</em><div><u id="rb1"></u></div></div>
    <div class="rb"><i>⏱️</i><span>剩餘時間</span><em id="rb2t">--</em><div><u id="rb2"></u></div></div>
    <div class="rb"><i>🔥</i><span>壓力值</span><em id="rb3t">低</em><div><u id="rb3"></u></div></div></div></div>
  <div id="rDisp"><div class="hd"><div class="ic blue"><svg viewBox="-12 -12 24 24" width="28" height="28"><g fill="#fff"><rect x="-3" y="-11" width="6" height="22" rx="1"/><rect x="-3" y="-11" width="6" height="22" rx="1" transform="rotate(60)"/><rect x="-3" y="-11" width="6" height="22" rx="1" transform="rotate(-60)"/></g><path d="M0-7V7" stroke="#1e5bd8" stroke-width="1.6"/></svg></div><div><b>緊急輔助醫療救護服務</b><span>接 CALL</span></div><div class="ph">📞</div></div>
    <p class="who" id="rdW">A188 救護車<br>收到控制中心指示</p><p class="cs" id="rdC">--</p><p class="pl" id="rdP">--</p>
    <div class="bt"><button id="rRes">RES</button><button id="rRej">REJ</button></div><div class="bl"><span>接受</span><span>拒絕</span></div></div>
  <div id="rTR"><div id="rlStars"></div><div id="rCash">$0</div><div id="rClock">時間：19:30</div><div id="rTag"><b>AMBULANCE ${CALLSIGN}</b><span>${REGION==='st'?'SHA TIN':'TUEN MUN'}</span><em id="rAvm"></em></div></div>`;
  document.body.append(d);
  const st=document.createElement('style'); st.textContent=`#rHud{display:none}body.real #rHud{display:block}
  body.real .top .card,body.real #stabBox,body.real #callBox{display:none!important}
  body.real #mini{position:fixed;left:12px;bottom:calc(132px + env(safe-area-inset-bottom));width:118px;height:118px;border:4px solid #2ea44f;border-right-color:#2563eb;border-bottom-color:#2563eb;box-shadow:0 4px 18px #0008;z-index:6}
  #rHud>div{position:fixed;z-index:6;color:#fff;font-family:inherit;text-shadow:0 1px 2px #000a}
  #rMis{left:10px;top:calc(10px + env(safe-area-inset-top));background:#141821d9;border-radius:10px;padding:7px 10px 7px 7px;max-width:min(62vw,330px);backdrop-filter:blur(3px)}
  #rMis .mt{display:flex;gap:8px}
  #rMis .ic,#rDisp .ic{width:38px;height:38px;flex:none;border-radius:8px;background:#c62828;display:grid;place-items:center;font-size:20px}
  #rMis small{display:block;font-size:10px;color:#ffb4b4;letter-spacing:1px}#rMis b{display:block;font-size:14px}#rMis span{display:block;font-size:12px;color:#d9dde3}#rMis .row{font-size:11px;margin-top:2px}#rMis .row b,#rMis .row span{display:inline;font-size:12px}#rMis .row b{color:#ffd166}
  #rMis.avm .ic{background:#2e7d32}#rMis.avm small{color:#a5f3b5}
  #rBars{display:flex;flex-direction:column;gap:3px;margin-top:6px;transition:opacity .3s,max-height .3s;max-height:90px;overflow:hidden}#rBars.hide{opacity:0;max-height:0;margin-top:0}
  .rb{display:grid;grid-template-columns:18px auto 32px 1fr;align-items:center;gap:4px;font-size:11px}
  .rb i{font-style:normal}.rb span{white-space:nowrap}.rb em{font-style:normal;font-weight:800;color:#ff8a65}.rb div{height:8px;min-width:50px;border:1.5px solid #ff6b4a;border-radius:5px;overflow:hidden}.rb u{display:block;height:100%;width:50%;background:linear-gradient(90deg,#ff3b2f,#ff8a3d)}
  #rDisp{left:10px;right:10px;top:calc(76px + env(safe-area-inset-top));max-width:340px;background:#141821ee;border-radius:12px;padding:10px;display:none}
  #rDisp.on{display:block;animation:rIn .35s ease-out}@keyframes rIn{from{transform:translateX(-30px);opacity:0}}
  #rDisp .hd{display:flex;gap:9px;align-items:center}#rDisp .ic.blue{background:#1e5bd8;font-size:24px}#rDisp .hd b{display:block;font-size:17px;color:#ffcf9a}#rDisp .hd span{font-size:16px;color:#ffcf9a}
  #rDisp .ph{margin-left:auto;font-size:24px;animation:rRing .5s infinite alternate}@keyframes rRing{to{transform:rotate(-18deg) scale(1.12)}}
  #rDisp p{margin:6px 2px;font-size:15px;line-height:1.35}#rDisp .cs{font-size:18px;font-weight:800}#rDisp .pl{font-size:16px;color:#d9dde3}
  #rDisp .bt{display:flex;gap:10px;margin-top:8px}#rDisp .bt button{flex:1;font:inherit;font-size:22px;font-weight:800;color:#fff;border-radius:6px;padding:8px 0;border:2px solid #fff6}
  #rRes{background:#237a3b}#rRej{background:#a12a2a}#rDisp .bl{display:flex;gap:10px}#rDisp .bl span{flex:1;text-align:center;font-size:11px;color:#bbb}
  #rTR{right:10px;top:calc(118px + env(safe-area-inset-top));text-align:right}
  #rlStars{color:#2f6fe8;display:flex;gap:3px;justify-content:flex-end;filter:drop-shadow(0 1px 2px #000a)}#rlStars span{display:block;line-height:0}#rlStars .off{color:#ffffff30;opacity:.5}
  #rCash,#rTag{display:none!important}#rCash{font-size:24px;font-weight:900}#rClock{display:inline-block;margin-top:4px;background:#141821cc;border-radius:6px;padding:3px 9px;font-size:16px;font-weight:700}
  body.real #toast{top:auto;bottom:calc(222px + env(safe-area-inset-bottom));background:none;color:#fff;font-size:19px;font-weight:900;text-shadow:0 0 3px #000,0 2px 4px #000,0 0 10px #000;max-width:92vw;text-align:center;white-space:normal}
  body.real #cap{bottom:calc(250px + env(safe-area-inset-bottom))}
  #rTR{top:calc(10px + env(safe-area-inset-top))}
  #rTag{margin-top:4px;font-weight:900;letter-spacing:1px}#rTag b{display:block;font-size:12px}#rTag span{display:block;font-size:10px;color:#cfd4da}#rTag em{display:block;font-style:normal;font-size:11px;font-weight:900;color:#7dff9a}#rTag.hide{display:none}
  body.real #bMenu{top:calc(150px + env(safe-area-inset-top))!important}body.real #bAEB{top:calc(184px + env(safe-area-inset-top))!important}
  @media (orientation:portrait){ #rMis{max-width:56vw}
    body.real #toast{bottom:auto;top:calc(172px + env(safe-area-inset-top));font-size:14px;line-height:1.3;max-width:94vw} #rDisp{top:calc(84px + env(safe-area-inset-top))} }`; document.head.append(st);
  return d; })();
const rq_=id=>document.getElementById(id);
function realStars(){ rq_('rlStars').innerHTML=[0,1,2,3,4].map(i=>'<span class="'+(i<S.lives?'':'off')+'"><svg viewBox="-12 -12 24 24" width="22" height="22"><g fill="currentColor" stroke="#fff" stroke-width="1.2"><rect x="-3" y="-11" width="6" height="22" rx="1"/><rect x="-3" y="-11" width="6" height="22" rx="1" transform="rotate(60)"/><rect x="-3" y="-11" width="6" height="22" rx="1" transform="rotate(-60)"/></g><path d="M0-7V7" stroke="#fff" stroke-width="1.4"/></svg></span>').join(''); }
function realCash(){ rq_('rCash').textContent=REAL.cash.toLocaleString()+' 分'; }
/* ----- 開／關 ----- */
function realBegin(on){ REAL.on=!!on; document.body.classList.toggle('real',REAL.on); realSky.visible=false; REAL.fx=false;
  if(!REAL.on){ REAL.dispatch=false; REAL.avm=false; REAL.pend=null; rq_('rDisp').classList.remove('on'); cam.fov=FOV0; cam.updateProjectionMatrix(); return; }
  realComposer(); REAL.stress=0; REAL.jobs=0; REAL.shift=0; REAL.avm=false; REAL.jobAt=null; REAL.pend=null; REAL.ending=false; REAL.dep=S.level.depot; rq_('rMis').classList.remove('avm'); rq_('rmS').textContent='緊急輔助醫療救護服務'; REAL.clock={day:14*60+20,dusk:19*60+28,night:2*60+40,rain:4*60}[S.level.tod]??19*60+28;
  REAL.fx=S.level.tod!=='day'; realSky.visible=S.level.tod==='dusk';   // 日間照用日間；黃昏、夜晚、落雨先加光暈同調色
  if(S.level.tod==='dusk') setTOD('real');
  realStars(); realCash();
  const k=S.kase; rq_('rdC').textContent=k.title; rq_('rdP').textContent=k.place; rq_('rdW').innerHTML='A188 救護車<br>收到控制中心指示';
  rq_('rDisp').classList.add('on'); REAL.dispatch=true; S.mode='dispatch'; vib([80,60,80]); }
rq_('rRes').onclick=()=>{ if(!REAL.dispatch) return; REAL.dispatch=false; rq_('rDisp').classList.remove('on');
  if(REAL.pend!=null){ const i=REAL.pend; REAL.pend=null; realNewJob(i); return; }
  S.mode='drive'; S.legStart=performance.now()/1000; toast('控制中心：'+S.kase.call); };
rq_('rRej').onclick=()=>{ if(!REAL.dispatch) return; REAL.dispatch=false; rq_('rDisp').classList.remove('on');
  if(REAL.pend!=null){ REAL.pend=null; toast('已拒絕 · 繼續 AVM 返'+DEPOT_NAME()); realAVMHud(); return; }
  toMenu(); };
const DEPOT_NAME=()=>{ const k=REAL.dep; return REGION==='st'?(k==='ts'?'田心救護站':'沙田救護站'):(k==='yl'?'元朗救護站':k==='tsw'?'天水圍救護站':'屯門救護站'); };
/* ----- 送院後：AVM（可供調派）返站，途中 30% 機會再接單 ----- */
function depotGate(){ const d=DEPOT.pos, fx=Math.sin(DEPOT.a), fz=Math.cos(DEPOT.a); for(let k=4;k<70;k+=2){ const px=d[0]+fx*k, pz=d[1]+fz*k; if(cellAt(px,pz)&1) return [px+fx*4,pz+fz*4]; } return d.slice(); }
function realAVMHud(){ hud('AVM · 返'+DEPOT_NAME(),'⑥ 可供調派 · 跟住橙色路線返站'); rq_('rmS').textContent='AVM · 可供調派'; rq_('rmT').textContent='返回'+DEPOT_NAME(); rq_('rMis').classList.add('avm'); }
function realFaceRoute(){   // AVM 一刻：車頭自動轉向路線方向
  const R=S.route; if(!R||R.pts.length<2) return; const c=S.car; let k=1; while(k<R.pts.length-1&&Math.hypot(R.pts[k][0]-c.x,R.pts[k][1]-c.z)<6) k++;
  const P=R.pts[k]; c.a=Math.atan2(P[0]-c.x,P[1]-c.z); c.v=0; S.camYaw=c.a; }
function realAVM(){   // 由 finish() 截住：交接完成 → AVM
  S.stars=S.lives; const pay=realPay(); REAL.jobs++; REAL.shift+=pay; REAL.avm=true; REAL.avmT=0;
  REAL.jobAt=Math.random()<0.9?6+Math.random()*22:null;   // 90%：返站途中再有新任務
  sirenSet(false); caption(null); clearEvents(); show('stabBox',false); patient.visible=false; bystander.visible=false;
  S.mode='drive'; S.step=6; S.leftDepot=true; S.depotCam=true; S.legLimit=1e6; S.legStart=performance.now()/1000;
  setTarget(depotGate()); refreshRoute(true); if(routeMesh) routeMesh.visible=true;
  realFaceRoute();
  realAVMHud(); toast('交接完成 +'+pay.toLocaleString()+' 分 · AVM 返站');
}
function realAtDepot(){ S.car.v=0; REAL.avm=false; REAL.ending=true; rq_('rMis').classList.remove('avm'); ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false; finish(); REAL.ending=false; }
function realOffer(){   // 控制中心派新單
  const pool=LEVELS.map((_,i)=>i).filter(i=>i!==S.lvl&&LMK[caseOf(LEVELS[i]).poi]); if(!pool.length) return;
  const i=pool[Math.floor(Math.random()*pool.length)], k=caseOf(LEVELS[i]); REAL.pend=i;
  rq_('rdC').textContent=k.title; rq_('rdP').textContent=k.place; rq_('rdW').innerHTML='A188 救護車（AVM）<br>控制中心有新任務';
  rq_('rDisp').classList.add('on'); REAL.dispatch=true; vib([80,60,80]); alarm(); }
function realNewJob(i){
  const lv=LEVELS[i]; S.lvl=i; S.level=lv; const k=caseOf(lv); S.kase=k; k.loc=LMK[k.poi]; const L=k.loc;
  if(NEON&&L.stop&&L.patient) NEON.rail.cutPath([L.stop,L.patient],3);
  AE=HOSPS[DEF_H]; S.dest=DEF_H; clearEvents(); REAL.avm=false; rq_('rMis').classList.remove('avm'); rq_('rmS').textContent='緊急輔助醫療救護服務';
  Object.assign(S,{mode:'drive',step:1,leftDepot:true,depotCam:true,equipOk:false,quizOk:false,triageOk:false,stab:100,stabLow:100,quizOpen:false,qDone:[false,false,!k.triage],qScore:0,qPending:0,dashLeft:lv.dash,dashT:14+Math.random()*10,tScene:0,tHosp:0,t0:performance.now()/1000,overT:false});
  setupScene(k,lv);
  patient.visible=true; patient.position.set(L.patient[0],0.3,L.patient[1]); patient.rotation.set(0,Math.random()*6,0);
  patient.userData.blanket.visible=false; patient.userData.p.position.set(0,0.5,1.2); patient.userData.p.rotation.set(-Math.PI/2,0,0);
  bystander.visible=true; bystander.position.set(L.patient[0]+2,0.2,L.patient[1]+1.5);
  setTarget(L.stop); refreshRoute(true); if(routeMesh) routeMesh.visible=true; startLeg(); S.escRoute=null;
  S.noCross=!!(lv.support||lv.escort); peds.forEach(p=>{ if(S.noCross&&p.mode==='cross') placePed(p,S.car.x,S.car.z); });
  if(lv.support) queueSupport(lv.support,true);
  hud('任務：'+k.place,'① 出車 · '+k.title); sirenSet(true); S.sirenUsed=true; toast('控制中心：'+k.call); }
/* ----- 每格 ----- */
function realTick(dt){ if(!REAL.on) return;
  if(REAL.avm&&S.mode==='drive'&&!REAL.dispatch){ REAL.avmT+=dt; if(REAL.jobAt!=null&&REAL.avmT>REAL.jobAt){ REAL.jobAt=null; realOffer(); } }
  { const hideB=S.quizOpen||REAL.dispatch||REAL.avm||S.step>=5||S.mode!=='drive'; rq_('rBars').classList.toggle('hide',hideB);
    rq_('rMis').style.display=REAL.dispatch||S.mode==='map'||S.mode==='result'||S.mode==='over'?'none':'';
    rq_('rTag').classList.toggle('hide',S.mode==='map'||S.mode==='result'); rq_('rAvm').textContent=REAL.avm?'● AVM':''; }
  if(S.mode==='drive'){ REAL.clock+=dt; const r=legLeft(); if(r<15) REAL.stress+=dt*5; REAL.stress-=dt*(S.siren?1.6:1); }
  REAL.stress=Math.max(0,Math.min(100,REAL.stress));
  if((REAL.ht=(REAL.ht||0)-dt)>0) return; REAL.ht=0.25;
  rq_('rmT').textContent=REAL.avm?'返回'+DEPOT_NAME():S.kase?S.kase.title:'--'; rq_('rmP').textContent=$('hTitle').textContent; rq_('rmD').textContent=$('hDist').textContent; rq_('rmL').textContent=REAL.avm?'—':$('hTime').textContent; rq_('rmLl').textContent=REAL.avm?'返站':'限時';
  const m=Math.floor(REAL.clock)%1440; rq_('rClock').textContent='時間：'+String(Math.floor(m/60)).padStart(2,'0')+String(m%60).padStart(2,'0');
  const st=S.stab??100; rq_('rb1').style.width=st+'%'; rq_('rb1t').textContent=st>70?'穩定':st>40?'一般':'危殆';
  const lf=S.legLimit?Math.max(0,legLeft())/S.legLimit:1; rq_('rb2').style.width=(lf*100)+'%'; rq_('rb2t').textContent=lf>0.5?'充足':lf>0.2?'緊張':'告急';
  rq_('rb3').style.width=REAL.stress+'%'; rq_('rb3t').textContent=REAL.stress<35?'低':REAL.stress<70?'中':'高';
  realStars(); }
function realPay(){ const pay=S.stars*400+S.onTime*250+(S.collided?0:300); REAL.cash+=pay; store.set('realCash',REAL.cash); realCash(); return pay; }
/* ----- 撳小地圖：放大地圖 + 暫停 ----- */
const BIGMAP=(()=>{ const d=document.createElement('div'); d.id='bigMap'; d.innerHTML='<div class="bh"><b>🗺️ 地圖 · 已暫停</b><button id="bmX" aria-label="關閉地圖">✕ 繼續</button></div><canvas id="bmC"></canvas><div class="lg"><span><i style="background:#1f4fbf"></i>救護車</span><span><i style="background:#e8323c"></i>目的地</span><span><i style="background:#ff7a1a"></i>路線</span><span>🏥 醫院</span><span>🚑 救護站</span></div>'; document.body.append(d);
  const st=document.createElement('style'); st.textContent=`#mini{pointer-events:auto;cursor:zoom-in}
  #bigMap{position:fixed;inset:0;z-index:60;background:#0b0f16f0;display:none;flex-direction:column;padding:calc(10px + env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom));color:#fff;font-family:inherit}
  #bigMap.on{display:flex}#bigMap .bh{display:flex;align-items:center;gap:10px;margin-bottom:8px}#bigMap .bh b{font-size:17px}
  #bmX{margin-left:auto;font:inherit;font-size:16px;font-weight:800;color:#fff;background:#237a3b;border:2px solid #fff6;border-radius:8px;padding:8px 16px}
  #bmC{flex:1;width:100%;min-height:0;border-radius:10px;background:#eef2e8}
  #bigMap .lg{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;margin-top:8px;color:#d9dde3}#bigMap .lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px}`; document.head.append(st);
  let t0=0;
  function draw(){ const cv=rq_('bmC'), dpr=Math.min(2,devicePixelRatio||1), W=cv.clientWidth, H=cv.clientHeight; cv.width=W*dpr; cv.height=H*dpr; const g=cv.getContext('2d'); g.scale(dpr,dpr);
    const c=S.car, P=[[c.x,c.z]]; if(S.target) P.push(S.target); if(S.route) S.route.pts.forEach(p=>P.push(p)); P.push(DEPOT.pos);
    let x0=Math.min(...P.map(p=>p[0]))-160, x1=Math.max(...P.map(p=>p[0]))+160, z0=Math.min(...P.map(p=>p[1]))-160, z1=Math.max(...P.map(p=>p[1]))+160;
    const cx=(x0+x1)/2, cz=(z0+z1)/2, sp=Math.max(600,x1-x0,(z1-z0)*W/H); const s=W/sp;   // 每米幾多 px
    const T=(x,z)=>[W/2+(x-cx)*s,H/2+(z-cz)*s];
    g.fillStyle='#eef2e8'; g.fillRect(0,0,W,H); g.imageSmoothingEnabled=true;
    const [ox,oz]=T(BX0-60,BZ0-60); g.drawImage(MM,ox,oz,MM.width/MMS*s,MM.height/MMS*s);
    if(S.route&&S.mode!=='seq'){ g.strokeStyle='#ff7a1a'; g.lineWidth=5; g.lineJoin=g.lineCap='round'; g.beginPath(); g.moveTo(...T(c.x,c.z)); (routeAhead()||[]).forEach((p,k)=>{ if(k) g.lineTo(...T(p[0],p[1])); }); g.stroke(); }
    g.font='20px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    Object.values(HOSPS).forEach(h=>{ const [a,b]=T(h.door[0],h.door[1]); g.fillText('🏥',a,b); g.font='bold 12px sans-serif'; g.fillStyle='#111'; g.fillText(h.name,a,b+18); g.font='20px sans-serif'; });
    { const [a,b]=T(DEPOT.pos[0],DEPOT.pos[1]); g.fillText('🚑',a,b); g.font='bold 12px sans-serif'; g.fillStyle='#111'; g.fillText(DEPOT_NAME(),a,b+18); }
    if(S.target){ const [a,b]=T(S.target[0],S.target[1]); g.fillStyle='#e8323c'; g.strokeStyle='#fff'; g.lineWidth=3; g.beginPath(); g.arc(a,b,9,0,7); g.fill(); g.stroke(); }
    { const [a,b]=T(c.x,c.z); g.save(); g.translate(a,b); g.rotate(-c.a+Math.PI); g.fillStyle='#1f4fbf'; g.strokeStyle='#fff'; g.lineWidth=2.5; g.beginPath(); g.moveTo(0,-13); g.lineTo(9,9); g.lineTo(0,4); g.lineTo(-9,9); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  }
  function open(){ if(S.mode!=='drive'||REAL.dispatch) return; S.mode='map'; t0=performance.now(); S.hold.L=S.hold.R=S.hold.G=S.hold.B=false; d.classList.add('on'); try{ if(actx) actx.suspend(); }catch(e){} requestAnimationFrame(draw); }
  function close(){ if(S.mode!=='map') return; const p=(performance.now()-t0)/1000; S.legStart+=p; S.t0+=p; S.mode='drive'; d.classList.remove('on'); try{ if(actx) actx.resume(); }catch(e){} clock.getDelta(); }
  $('mini').addEventListener('click',e=>{ e.stopPropagation(); open(); }); rq_('bmX').onclick=close; d.addEventListener('click',e=>{ if(e.target===d) close(); });
  addEventListener('keydown',e=>{ if(e.code==='KeyM'&&!e.repeat){ S.mode==='map'?close():open(); } if(e.code==='Escape') close(); });
  addEventListener('resize',()=>{ if(S.mode==='map') draw(); });
  return {open,close,draw}; })();

/* ---------- 支援人員到場幫手：救護電單車急救員、消防先遣急救員 ----------
   到場後落車行去病人身邊幫手；離場時電單車急救員跟救護車一齊上車（電單車留喺原地），消防員行返上消防車 */
const HELP=(()=>{ const H=[]; let JC=null;
  function mk(kind){ const p=person('crew'); if(kind==='fire') p.traverse(o=>{ if(!o.material||!o.material.color) return; const h=o.material.color.getHex();
      if(h===C.jacket) o.material.color.setHex(0x1d2a48); else if(h===0x1f4fbf||h===0x183f99) o.material.color.setHex(0xf2c200); });   // 消防：深藍制服、黃頭盔
    p.scale.setScalar(0.92); scene.add(p); return p; }
  function spawn(e){ e.helped=true; const n=e.kind==='fire'?2:1, ps=e.pose; for(let i=0;i<n;i++){ const p=mk(e.kind); const side=i?-1:1, ox=Math.cos(ps.a)*side*1.6, oz=-Math.sin(ps.a)*side*1.6;
      const home=[ps.x+ox,ps.z+oz]; p.position.set(home[0],0.15,home[1]); H.push({e,p,kind:e.kind,i,st:'go',home,x:home[0],z:home[1]}); } }
  function slot(h){ const P=S.kase&&S.kase.loc&&S.kase.loc.patient; if(!P) return [h.x,h.z]; const k=h.kind==='moto'?[-1.5,1.6]:h.i?[1.9,-1.4]:[1.9,1.4]; return [P[0]+k[0],P[1]+k[1]]; }
  function step(h,T,dt,t,sp){ const dx=T[0]-h.x, dz=T[1]-h.z, d=Math.hypot(dx,dz); if(d<0.25){ walk(h.p,t,false); return true; } const m=Math.min(d,sp*dt); h.x+=dx/d*m; h.z+=dz/d*m; h.p.rotation.y=Math.atan2(dx,dz); walk(h.p,t,true,h.i*1.3); h.p.position.set(h.x,0.15,h.z); return false; }
  function tick(dt,t){ if(S.gm!=='ems') return;
    if(S.step<=2) ESC.forEach(e=>{ if(e.kind&&e.kind!=='police'&&e.done&&!e.helped&&e.pose) spawn(e); });
    if(!H.length) return; const loading=S.step>=3||(S.mode==='seq'&&S.seq>=6.6);
    for(const h of H){ if(h.st==='gone') continue;
      if(!loading){ const T=slot(h); if(step(h,T,dt,t,3.0)){ h.st='help'; const P=S.kase.loc.patient; h.p.rotation.y=Math.atan2(P[0]-h.x,P[1]-h.z); h.p.position.y=-0.25; h.p.userData.arms&&h.p.userData.arms.forEach(a=>a.rotation.x=-0.6-Math.sin(t*4+h.i)*0.35); } else h.p.position.y=0.15; continue; }
      h.p.position.y=0.15;
      if(h.kind==='moto'){ // 跟車床一齊行，上救護車
        const tgt=crew.visible?[crew.position.x+Math.cos(crew.rotation.y)*1.4,crew.position.z-Math.sin(crew.rotation.y)*1.4]:[S.car.x-Math.sin(S.car.a)*4.6,S.car.z-Math.cos(S.car.a)*4.6];
        step(h,tgt,dt,t,3.2); if(!crew.visible&&Math.hypot(tgt[0]-h.x,tgt[1]-h.z)<0.6||S.step>=4){ h.st='gone'; h.p.visible=false; } }
      else { if(step(h,h.home,dt,t,2.4)||S.step>=4&&!inView(h.x,h.z,3)){ h.st='gone'; h.p.visible=false; } } } }
  function clear(){ H.forEach(h=>scene.remove(h.p)); H.length=0; }
  window.__HELP=()=>H.map(h=>[h.kind,h.i,h.st,Math.round(h.x),Math.round(h.z),h.p.visible]); return {tick,clear}; })();
/* ======================= 遊戲性：無線電、讓路連擊、三個挑戰、新手教學、突發事件 ======================= */
const PLAY=(()=>{
  const st=document.createElement('style'); st.textContent=`
  #radio{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top));transform:translateX(-50%) translateY(-8px);z-index:22;max-width:min(560px,86vw);background:#0f1a14e8;color:#d8ffe4;border:1.5px solid #3ccf72;border-radius:10px;padding:6px 12px 7px 10px;font-size:14px;line-height:1.4;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;box-shadow:0 4px 14px #0006}
  #radio.on{opacity:1;transform:translateX(-50%)}@media (max-width:640px){#radio{top:calc(118px + env(safe-area-inset-top));font-size:13px;left:10px;transform:translateY(-8px);max-width:calc(100vw - 104px)}#radio.on{transform:none}}body.real #radio{top:calc(170px + env(safe-area-inset-top))}#radio b{color:#7dff9a;font-size:11px;letter-spacing:1px;display:block}
  #yCombo{position:fixed;left:50%;top:34%;transform:translate(-50%,-50%) scale(.6);z-index:21;font-weight:900;font-size:30px;color:#fff;text-shadow:0 3px 0 #1f63e0,0 0 18px #3b8bff;opacity:0;pointer-events:none;transition:opacity .2s,transform .25s;white-space:nowrap}
  #yCombo.on{opacity:1;transform:translate(-50%,-50%) scale(1)}#yCombo small{display:block;font-size:15px;text-align:center;color:#cfe3ff;text-shadow:0 1px 0 #0008}
  #coach{position:fixed;left:50%;bottom:calc(132px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:23;width:min(520px,90vw);background:#fffdf3;color:#2a2a2a;border:3px solid #ffb703;border-radius:14px;padding:10px 14px;font-size:16px;line-height:1.45;box-shadow:0 6px 18px #0005;display:none}
  #coach.on{display:block}#coach b{color:#e36414}#coach .pg{float:right;font-size:12px;color:#888}
  .tutPulse{animation:tutP 1s infinite}@keyframes tutP{0%,100%{box-shadow:0 0 0 0 #ffb703cc}50%{box-shadow:0 0 0 12px #ffb70300}}
  #rChal{display:flex;gap:8px;justify-content:center;margin:6px 0 2px;flex-wrap:wrap}#rChal span{border-radius:20px;padding:4px 10px;font-size:13px;font-weight:700;background:#eef1f5;color:#8a93a0}#rChal span.ok{background:#e2f7e8;color:#1b7a3a}
  .chal{margin-left:6px;font-size:12px;letter-spacing:1px}.chal i{font-style:normal;opacity:.25}.chal i.on{opacity:1}`; document.head.append(st);
  const R=document.createElement('div'); R.id='radio'; R.setAttribute('aria-live','polite'); document.body.append(R);
  const Y=document.createElement('div'); Y.id='yCombo'; document.body.append(Y);
  const CO=document.createElement('div'); CO.id='coach'; CO.setAttribute('aria-live','polite'); document.body.append(CO);
  /* ---- 無線電字幕 ---- */
  let rq=[], rt=null;
  function chirp(){ try{ if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type='square'; o.frequency.setValueAtTime(1400,actx.currentTime); o.frequency.setValueAtTime(1000,actx.currentTime+0.06); g.gain.setValueAtTime(0.03,actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.14); o.connect(g); g.connect(master||actx.destination); o.start(); o.stop(actx.currentTime+0.15); }catch(e){} }
  function radio(msg,who){ rq.push([msg,who||'控制中心']); if(!rt) next(); }
  function next(){ const m=rq.shift(); if(!m){ R.classList.remove('on'); rt=null; return; } R.innerHTML='<b>📻 '+m[1]+'</b>'+m[0]; R.classList.add('on'); chirp(); rt=setTimeout(()=>{ R.classList.remove('on'); rt=setTimeout(next,280); },Math.min(6000,2600+m[0].length*70)); }
  function radioClear(){ rq=[]; clearTimeout(rt); rt=null; R.classList.remove('on'); }
  /* ---- 讓路連擊 ---- */
  let yc=0, yT=0, yHide=null;
  function yieldFx(){ const now=performance.now(); yc=now-yT<6000?yc+1:1; yT=now; S.yieldScore=(S.yieldScore||0)+10*yc; Y.innerHTML='🚑 讓路 ×'+yc+'<small>+'+(10*yc)+' 分 · 多謝讓路！</small>'; Y.classList.add('on'); clearTimeout(yHide); yHide=setTimeout(()=>Y.classList.remove('on'),1400); }
  /* ---- 三個挑戰 ---- */
  const CH=[['🛡️','冇撞車'],['⏱️','兩段準時'],['🧠','全部答啱']];
  function chalNow(){ const nq=2+(S.kase&&S.kase.triage?1:0); return [!S.collided,S.onTime>=2,S.qScore>=nq]; }
  function chalSave(id,c){ const all=store.get('chal',{}); const b=(all[id]||0)|(c[0]?1:0)|(c[1]?2:0)|(c[2]?4:0); all[id]=b; store.set('chal',all); return b; }
  function chalBits(id){ return (store.get('chal',{})[id])||0; }
  function chalHTML(id){ const b=chalBits(id); return '<span class="chal" title="挑戰：冇撞車／兩段準時／全部答啱">'+CH.map((c,i)=>'<i class="'+(b&(1<<i)?'on':'')+'">'+c[0]+'</i>').join('')+'</span>'; }
  function chalResult(){ if(!S.level||S.gm!=='ems'||FUN.on) return; const c=chalNow(); const b=chalSave(S.level.id,c); let el=$('rChal'); if(!el){ el=document.createElement('div'); el.id='rChal'; $('rTime').after(el); }
    el.innerHTML=CH.map((x,i)=>'<span class="'+(c[i]?'ok':'')+'">'+(c[i]?'✅ ':'⬜ ')+x[0]+' '+x[1]+'</span>').join('')+(b===7?'<span class="ok">🏅 三個挑戰全部完成過</span>':''); }
  /* ---- 新手教學 ---- */
  const TUT=[
    {t:'撳住右下角「<b>油</b>」出車（鍵盤 ↑、手掣 RT）。',btn:'bG',done:()=>S.car.v>3},
    {t:'撳「<b>警號</b>」開閃燈同警號，其他車會讓路（鍵盤 H、手掣 X）。',btn:'bH',done:()=>S.siren},
    {t:'用 <b>◀ ▶</b> 轉彎，跟住地上<b>淺橙色線</b>行；路口有<b>藍色「》」</b>指示牌就跟住佢轉。',btn:'bL',done:(T)=>T>9},
    {t:'撳左上角<b>小地圖</b>可以睇大地圖，遊戲會暫停。睇完撳「✕ 繼續」。',btn:'mini',done:(T)=>T>7},
    {t:'記住：冇開警號衝紅燈、撞到人、超時都會扣<b>生命之星</b>（教學模式唔扣）。',done:(T)=>T>7},
    {t:'就到喇！見到<b>橙色圈</b>就停入去，救護員會落車。',done:()=>S.step>=2,wait:()=>S.target&&Math.hypot(S.target[0]-S.car.x,S.target[1]-S.car.z)<90},
    {t:'救護員會問你揀<b>裝備</b>同答<b>急救小測</b>，揀你覺得啱嘅答案。',done:()=>S.step>=4},
    {t:'而家<b>送院</b>：跟住新路線去急症室。轉彎同煞車要慢慢嚟，病人先唔會辛苦。',done:(T)=>T>8},
    {t:'做得好！跟住路線到急症室，停入橙色圈就完成任務。',done:()=>S.step>=5}];
  let ti=-1, tT=0, lastBtn=null;
  function tutStart(){ S.tut=true; ti=0; tT=0; showStep(); }
  function showStep(){ if(lastBtn) lastBtn.classList.remove('tutPulse'); const sp=TUT[ti]; if(!sp){ tutEnd(); return; }
    CO.innerHTML='<span class="pg">新手教學 '+(ti+1)+' / '+TUT.length+'</span>🎓 '+sp.t; CO.classList.add('on'); lastBtn=sp.btn?$(sp.btn):null; if(lastBtn) lastBtn.classList.add('tutPulse'); }
  function tutEnd(){ if(lastBtn) lastBtn.classList.remove('tutPulse'); CO.classList.remove('on'); ti=-1; }
  function tutTick(dt){ if(!S.tut||ti<0) return; const sp=TUT[ti]; if(!sp) return; const vis=(S.mode==='drive'||S.mode==='seq'||S.mode==='hseq')&&!S.quizOpen;
    if(sp.wait&&!sp.wait()){ CO.classList.remove('on'); return; } CO.classList.toggle('on',vis);
    if(S.mode==='drive'||ti>=5) tT+=dt; if(sp.done(tT)){ ti++; tT=0; showStep(); } }
  /* ---- 突發事件：唔讓路嘅私家車、前面交通意外改道 ---- */
  const EV={stub:false,acc:false};
  function evReset(){ EV.stub=Math.random()<0.55; EV.acc=!(S.level&&S.level.works)&&Math.random()<0.35; EV.stubDone=false; EV.accDone=false; }
  function evTick(dt){ if(S.mode!=='drive'||S.gm!=='ems'||S.tut||FUN.on||!S.route||!S.leftDepot) return; const c=S.car;
    const prog=S.route.len?1-Math.hypot(S.target[0]-c.x,S.target[1]-c.z)/Math.max(60,S.route.len):0;
    if(EV.stub&&!EV.stubDone&&S.step===1&&S.siren&&c.v>6){ const fx=Math.sin(c.a), fz=Math.cos(c.a);
      const k=cars.find(k=>k.pose&&!k.stuck&&!k.fly&&(()=>{ const dx=k.pose.x-c.x, dz=k.pose.z-c.z, ah=dx*fx+dz*fz, lat=Math.abs(dx*fz-dz*fx); return ah>22&&ah<55&&lat<3.2&&Math.cos(k.pose.a-c.a)>0.85; })());
      if(k){ EV.stubDone=true; k.stubborn=6; radio('前面有架私家車冇留意警號，小心！可以用對面線小心爬頭，或者等佢讓路。'); } }
    if(EV.acc&&!EV.accDone&&S.step===4&&prog>0.15){ EV.accDone=true; accidentAhead(); } }
  function accidentAhead(){ const c=S.car; const E0=routeEdges(); const E=E0.filter(([a,b])=>{ const A=NODES[a],B=NODES[b], mx=(A[0]+B[0])/2, mz=(A[1]+B[1])/2; return Math.hypot(mx-c.x,mz-c.z)>80&&!inView(mx,mz,6); }); if(!E.length) return 'no edge '+E0.length;
    for(let tries=0;tries<Math.min(6,E.length);tries++){ const [a,b,r]=E[(tries*3+1)%E.length]; if(r.closed) continue; const m0=EVT.meshes.length, c0=EVT.cells.length, len0=S.route.len; closeRoad(a,b,r,'交通意外 請改道'); refreshRoute(true);
      const P=S.route?S.route.path:[]; let bad=false; for(let i=1;i<P.length;i++){ const q=EDGE[P[i-1]+'-'+P[i]]; if(q&&q.closed) bad=true; }
      if(bad||S.route.len>len0*1.8+200){ EVT.meshes.splice(m0).forEach(m=>scene.remove(m)); EVT.cells.splice(c0).forEach(k=>grid[k]&=~2); r.closed=false; CLOSED.splice(CLOSED.indexOf(r),1); refreshRoute(true); continue; }
      hazardCar(a,b,r,0.35,true); hazardCar(a,b,r,0.42,true);
      radio((r.name||'前面')+'發生交通意外，警方封路。已經幫你改道，跟住新路線去醫院。'); S.legLimit+=Math.round((S.route.len-len0)/14)+10; return 'ok'; }
    return 'no detour'; }
  return {radio,radioClear,yieldFx,chalResult,chalHTML,tutStart,tutEnd,tutTick,evReset,evTick,_acc:accidentAhead,_ev:EV};
})();
/* ---------- 遊戲手掣（Gamepad API 標準配置：Xbox／PS／Switch Pro 等） ----------
   揸車：左搖桿或十字鍵左右＝轉彎；RT 或 A＝油；LT 或 B＝煞車／倒車；X＝警號；Y＝大地圖；Start＝選單
   選單／答題：十字鍵或左搖桿移動，A＝確定，B＝關閉地圖或聲明 */
const GP=(()=>{ let prev={}, sel=-1, navT=0, list=[];
  const st=document.createElement('style'); st.textContent='.gpf{outline:4px solid #ffd166!important;outline-offset:3px;box-shadow:0 0 0 7px #ffd16655!important}'; document.head.append(st);
  addEventListener('gamepadconnected',e=>{ toast('🎮 已連接手掣'); });
  addEventListener('gamepaddisconnected',()=>{ ['L','R','G','B'].forEach(k=>S.hold[k]=false); });
  const visible=b=>b&&b.offsetParent!==null&&!b.disabled&&getComputedStyle(b).visibility!=='hidden';
  const LAYERS=['#legalBox','#bigMap.on','#rDisp.on','.gfxAsk','#quiz.show','#over.show','#result.show','#menu.show'];
  function layer(){ for(const q of LAYERS){ const el=document.querySelector(q); if(el&&el.offsetParent!==null||el&&getComputedStyle(el).position==='fixed'&&getComputedStyle(el).display!=='none') return el; } return null; }
  function setSel(i){ list.forEach(b=>b.classList.remove('gpf')); if(!list.length){ sel=-1; return; } sel=(i+list.length)%list.length; const b=list[sel]; b.classList.add('gpf'); b.scrollIntoView({block:'nearest'}); }
  function frame(){ requestAnimationFrame(frame);
    const pads=navigator.getGamepads?navigator.getGamepads():[]; let p=null; for(const g of pads) if(g&&g.connected){ p=g; break; } if(!p) return;
    const B=i=>!!(p.buttons[i]&&(p.buttons[i].pressed||p.buttons[i].value>0.3)), down=i=>B(i)&&!prev[i];
    const ax=p.axes[0]||0, ay=p.axes[1]||0;
    const L=layer(); const driving=!L&&S.mode==='drive'&&!S.quizOpen;
    if(driving){ list.forEach(b=>b.classList.remove('gpf')); list=[]; sel=-1;
      const h={L:ax<-0.35||B(14), R:ax>0.35||B(15), G:B(7)||B(0), B:B(6)||B(1)}; for(const k in h){ if(h[k]!==prev['h'+k]) S.hold[k]=h[k]; prev['h'+k]=h[k]; }
      if(down(2)) $('bH').click(); if(down(3)&&typeof BIGMAP!=='undefined') BIGMAP.open(); if(down(9)) $('bMenu').click();
    } else {
      ['L','R','G','B'].forEach(k=>{ if(prev['h'+k]){ S.hold[k]=false; prev['h'+k]=false; } });
      const cand=!L?[]:[...L.querySelectorAll('button')].filter(b=>visible(b)&&!b.closest('.btns,#footBtns,#bMenu,#bAEB')||b.id==='bMenu'||b.id==='bAEB');
      if(cand.length!==list.length||cand.some((b,i)=>b!==list[i])){ list=cand; setSel(Math.max(0,list.indexOf(document.querySelector('.gpf')))); }
      const now=performance.now(); const dir=(B(13)||B(15)||ay>0.5||ax>0.5)?1:(B(12)||B(14)||ay<-0.5||ax<-0.5)?-1:0;
      if(dir&&now>navT){ setSel(sel+dir); navT=now+(prev.dir===dir?140:260); } prev.dir=dir;
      if(down(0)&&list[sel]) list[sel].click();
      if(down(1)){ const x=document.querySelector('#bmX'); if(S.mode==='map'&&x) x.click(); const lx=document.querySelector('#legalBox #lgX'); if(lx&&visible(lx)) lx.click(); }
      if(down(3)&&S.mode==='map'&&typeof BIGMAP!=='undefined') BIGMAP.close();
    }
    for(let i=0;i<p.buttons.length;i++) prev[i]=B(i);
  }
  requestAnimationFrame(frame); return {}; })();
window.__ESC=ESC; window.__PLAY=PLAY;

renderMenu(); show('menu',true); tick();
window.__S=S; window.__ELEV=ELEV; window.__RM=()=>routeMesh; window.__finish=()=>finish(); window.__REAL=REAL; window.__gate=()=>depotGate(); window.__hit=hitBuilding; window.__cell=cellAt; window.__NEON=NEON; window.__MAP=MAP; window.__NODES=NODES; window.__setTarget=setTarget; window.__refreshRoute=refreshRoute; window.__AE=()=>AE; window.__DEPOT=()=>DEPOT; window.__setTOD=setTOD; window.__cars=cars; window.__sg=()=>gain&&gain.gain.value; window.__oc=openChoice; window.__veh=applyLivery; window.__LMK=LMK; window.__fwTest=fireworks; window.__R=R; window.__person=person; window.__peds=peds; window.__store=store; window.__scene=scene; window.__cam=cam; window.__startCase=startCase; window.__peds=peds;

})();